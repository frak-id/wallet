import Foundation
import Testing

@testable import FrakSDK

@Suite("InteractionTracker")
struct InteractionTrackerTests {
    private static let merchantId = "550e8400-e29b-41d4-a716-446655440000"
    private static let clientId = "256b1be3-2745-41d1-89d4-9121cc87bc45"
    private static let otherClientId = "550e8400-e29b-41d4-a716-446655440001"

    /// A scripted backend: one response per call while the script lasts, then the last one
    /// forever. `nil` in the script is a transport failure.
    private final class Backend: @unchecked Sendable {
        private let lock = NSLock()
        private var script: [StubResponse?] = []
        private var fallback: StubResponse? = StubResponse(status: 200, body: "{}")
        private var seen: [URLRequest] = []

        func respond(_ response: StubResponse?) {
            lock.lock()
            defer { lock.unlock() }
            script = []
            fallback = response
        }

        func respondEach(_ responses: [StubResponse?]) {
            lock.lock()
            defer { lock.unlock() }
            script = responses
        }

        var requests: [URLRequest] {
            lock.lock()
            defer { lock.unlock() }
            return seen
        }

        func handle(_ request: URLRequest) throws -> StubResponse {
            lock.lock()
            seen.append(request)
            let response = script.isEmpty ? fallback : script.removeFirst()
            lock.unlock()
            guard let response else { throw URLError(.notConnectedToInternet) }
            return response
        }
    }

    private final class Fixture {
        let backend = Backend()
        let clock = Clock()
        let queue: EventQueue
        let tracker: InteractionTracker
        private let keys = Counter()
        private let currentId: Box<String?>

        init(clientId: String? = InteractionTrackerTests.clientId) {
            let (session, host) = StubURLProtocol.makeSession()
            let backend = self.backend
            StubURLProtocol.handle(host: host) { try backend.handle($0) }

            let fileURL =
                FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString, isDirectory: true)
                .appendingPathComponent(EventQueue.fileName)
            let logger = FrakLogger(level: .none)
            self.queue = EventQueue(fileURL: fileURL, logger: logger)
            self.currentId = Box(clientId)

            let clock = self.clock
            let keys = self.keys
            let currentId = self.currentId
            self.tracker = InteractionTracker(
                queue: queue,
                http: HTTPClient(baseURL: "https://\(host)", session: session),
                logger: logger,
                currentClientId: { currentId.value },
                now: { clock.current },
                newKey: { "key-\(keys.increment() - 1)" },
                // Deterministic jitter: the top of the range, so a test advancing the clock
                // past the maximum delay always clears the window.
                backoff: Backoff(now: { clock.current }, random: { $0.upperBound })
            )
        }

        var identity: String? {
            get { currentId.value }
            set { currentId.value = newValue }
        }

        func advancePastBackoff() {
            clock.current.addTimeInterval(Backoff.maxDelay + 1)
        }

        func pending() async -> [QueuedEvent] {
            await queue.read(now: clock.current)
        }
    }

    /// A lock-protected mutable box, for values a `@Sendable` closure reads after the test
    /// has changed them.
    private final class Box<Value: Sendable>: @unchecked Sendable {
        private let lock = NSLock()
        private var stored: Value

        init(_ value: Value) { stored = value }

        var value: Value {
            get {
                lock.lock()
                defer { lock.unlock() }
                return stored
            }
            set {
                lock.lock()
                stored = newValue
                lock.unlock()
            }
        }
    }

    @Test("posts a sharing interaction with the client id header and drains the queue")
    func postsASharingInteraction() async throws {
        let fixture = Fixture()
        fixture.clock.current = Date(timeIntervalSince1970: 1_709_654_400)

        await fixture.tracker.track(merchantId: Self.merchantId, clientId: Self.clientId, interaction: .sharing())
        // track detaches its drain; flush awaits it, including one already under way.
        await fixture.tracker.flush()

        let request = try #require(fixture.backend.requests.last)
        #expect(fixture.backend.requests.count == 1)
        #expect(request.httpMethod == "POST")
        #expect(request.url?.path == "/user/track/interaction")
        #expect(request.value(forHTTPHeaderField: "x-frak-client-id") == Self.clientId)

        let body = request.stubJSON
        #expect(body["type"] as? String == "sharing")
        #expect(body["merchantId"] as? String == Self.merchantId)
        #expect(body["sharingTimestamp"] as? Int == 1_709_654_400)
        #expect(body["idempotencyKey"] as? String == "key-0")

        let pending = await fixture.pending()
        #expect(pending.isEmpty)
    }

    @Test("keeps the capture timestamp and the idempotency key across a retry")
    func keepsCaptureTimestampAcrossARetry() async throws {
        let fixture = Fixture()
        fixture.clock.current = Date(timeIntervalSince1970: 1_709_654_400)
        fixture.backend.respond(nil)

        await fixture.tracker.track(merchantId: Self.merchantId, clientId: Self.clientId, interaction: .sharing())
        await fixture.tracker.flush()
        let queued = await fixture.pending()
        #expect(queued.count == 1)

        fixture.clock.current.addTimeInterval(6 * 60 * 60)
        fixture.backend.respond(StubResponse(status: 200, body: "{}"))
        await fixture.tracker.flush()

        let body = try #require(fixture.backend.requests.last).stubJSON
        #expect(body["sharingTimestamp"] as? Int == 1_709_654_400)
        #expect(body["idempotencyKey"] as? String == "key-0")
    }

    @Test("sends oldest first and stops at the first failure")
    func sendsOldestFirstAndStops() async throws {
        let fixture = Fixture()
        fixture.backend.respond(nil)
        await fixture.tracker.track(merchantId: Self.merchantId, clientId: Self.clientId, interaction: .custom("first"))
        await fixture.tracker.track(
            merchantId: Self.merchantId,
            clientId: Self.clientId,
            interaction: .custom("second")
        )
        // Both detached drains must settle before the clock moves, or the backoff this test
        // advances past was never armed.
        await fixture.tracker.flush()

        fixture.advancePastBackoff()
        fixture.backend.respondEach([StubResponse(status: 200, body: "{}"), StubResponse(status: 503, body: "")])
        await fixture.tracker.flush()

        let sent = fixture.backend.requests.compactMap { $0.stubJSON["customType"] as? String }
        #expect(sent.contains("first"))
        let pending = await fixture.pending()
        #expect(pending.count == 1)
        #expect(pending.first?.body.contains("second") == true)
    }

    @Test("backs off after a failure instead of retrying immediately")
    func backsOffAfterAFailure() async {
        let fixture = Fixture()
        fixture.backend.respond(StubResponse(status: 503, body: ""))
        await fixture.tracker.track(merchantId: Self.merchantId, clientId: Self.clientId, interaction: .sharing())
        await fixture.tracker.flush()

        let attempts = fixture.backend.requests.count
        await fixture.tracker.flush()
        #expect(fixture.backend.requests.count == attempts)

        fixture.advancePastBackoff()
        fixture.backend.respond(StubResponse(status: 200, body: "{}"))
        await fixture.tracker.flush()
        let pending = await fixture.pending()
        #expect(pending.isEmpty)
    }

    @Test("drops an event the backend keeps rejecting rather than blocking the queue")
    func dropsAPoisonEvent() async {
        let fixture = Fixture()
        fixture.backend.respond(StubResponse(status: 422, body: #"{"success":false,"code":"BAD"}"#))
        await fixture.tracker.track(
            merchantId: Self.merchantId,
            clientId: Self.clientId,
            interaction: .custom("poison")
        )
        await fixture.tracker.track(
            merchantId: Self.merchantId,
            clientId: Self.clientId,
            interaction: .custom("healthy")
        )
        await fixture.tracker.flush()

        for _ in 0..<3 {
            fixture.advancePastBackoff()
            await fixture.tracker.flush()
        }

        let pending = await fixture.pending()
        #expect(pending.count == 1)
        #expect(pending.first?.body.contains("healthy") == true)
    }

    @Test("drops events captured under an id that has since been replaced")
    func dropsEventsFromAReplacedIdentity() async {
        let fixture = Fixture()
        fixture.backend.respond(nil)
        await fixture.tracker.track(merchantId: Self.merchantId, clientId: Self.clientId, interaction: .sharing())
        await fixture.tracker.flush()

        fixture.identity = Self.otherClientId
        fixture.advancePastBackoff()
        fixture.backend.respond(StubResponse(status: 200, body: "{}"))
        let before = fixture.backend.requests.count
        await fixture.tracker.flush()

        #expect(fixture.backend.requests.count == before)
        let pending = await fixture.pending()
        #expect(pending.isEmpty)
    }

    @Test("compacts expired rows off disk even with nothing to send")
    func compactsExpiredRows() async {
        let fixture = Fixture()
        fixture.backend.respond(nil)
        await fixture.tracker.track(merchantId: Self.merchantId, clientId: Self.clientId, interaction: .sharing())
        await fixture.tracker.flush()

        fixture.clock.current.addTimeInterval(EventQueue.maxAge + 1)
        await fixture.tracker.flush()

        let pending = await fixture.pending()
        #expect(pending.isEmpty)
    }

    @Test("purge leaves nothing to emit under a dead id")
    func purgeEmptiesTheQueue() async {
        let fixture = Fixture()
        fixture.backend.respond(nil)
        await fixture.tracker.track(merchantId: Self.merchantId, clientId: Self.clientId, interaction: .sharing())
        await fixture.tracker.flush()

        await fixture.tracker.purge()

        let pending = await fixture.pending()
        #expect(pending.isEmpty)
    }

    @Test("posts a purchase with the merchant and checkout token")
    func postsAPurchase() async throws {
        let fixture = Fixture()
        await fixture.tracker.trackPurchase(
            merchantId: Self.merchantId,
            clientId: Self.clientId,
            customerId: "cust-1",
            orderId: "order-1",
            token: "tok-1"
        )
        await fixture.tracker.flush()

        let request = try #require(fixture.backend.requests.last)
        #expect(request.url?.path == "/user/track/purchase")
        let body = request.stubJSON
        #expect(body["merchantId"] as? String == Self.merchantId)
        #expect(body["customerId"] as? String == "cust-1")
        #expect(body["orderId"] as? String == "order-1")
        #expect(body["token"] as? String == "tok-1")
    }

    @Test("omits absent arrival fields rather than sending them null")
    func omitsAbsentArrivalFields() async throws {
        let fixture = Fixture()
        await fixture.tracker.track(
            merchantId: Self.merchantId,
            clientId: Self.clientId,
            interaction: .arrival(referrerClientId: Self.clientId, referralTimestamp: 1_709_654_000)
        )
        await fixture.tracker.flush()

        let body = try #require(fixture.backend.requests.last).stubJSON
        #expect(body["type"] as? String == "arrival")
        #expect(body["referrerClientId"] as? String == Self.clientId)
        #expect(body["referralTimestamp"] as? Int == 1_709_654_000)
        #expect(!body.keys.contains("referrerWallet"))
        #expect(!body.keys.contains("referrerMerchantId"))
    }

    @Test("sends no client id header when the event was captured without one")
    func omitsTheHeaderWithoutAnIdentity() async throws {
        let fixture = Fixture(clientId: nil)
        await fixture.tracker.track(merchantId: Self.merchantId, clientId: nil, interaction: .sharing())
        await fixture.tracker.flush()

        let request = try #require(fixture.backend.requests.last)
        #expect(request.value(forHTTPHeaderField: "x-frak-client-id") == nil)
    }
}
