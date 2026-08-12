import Foundation
import Testing

@testable import FrakSDK

@Suite("EventOutbox")
struct EventOutboxTests {
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
        let fileURL: URL
        let tracker: EventOutbox
        private let keys = Counter()
        private let currentId: Box<String?>
        /// Egress gate: "consent is withdrawn once N events have reached the wire." Keyed off
        /// the backend rather than a call counter, so a test states what it means, independent
        /// of how many times the drain consults the gate.
        let denyTrackingAfterRequests = Box(Int.max)
        /// Stands in for a device before its first unlock, where the identity file is intact but
        /// unreadable.
        let identityReadable = Box(true)

        init(
            clientId: String? = EventOutboxTests.clientId,
            resolveMerchantId: (@Sendable () async -> String?)? = nil,
            signProof: (@Sendable (ProofOp, String, Data) async -> String?)? = nil,
            /// Fires once per `drain()` pass (`currentClientId` is read exactly once per pass),
            /// so a test can count passes without instrumenting production code.
            onDrainPass: (@Sendable () -> Void)? = nil
        ) {
            let (session, host) = StubURLProtocol.makeSession()
            let backend = self.backend
            StubURLProtocol.handle(host: host) { try backend.handle($0) }

            let fileURL =
                FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString, isDirectory: true)
                .appendingPathComponent(EventQueue.fileName)
            self.fileURL = fileURL
            let logger = FrakLogger(level: .none)
            self.queue = EventQueue(fileURL: fileURL, logger: logger)
            self.currentId = Box(clientId)

            let clock = self.clock
            let keys = self.keys
            let currentId = self.currentId
            let deny = self.denyTrackingAfterRequests
            let readable = self.identityReadable
            self.tracker = EventOutbox(
                queue: queue,
                http: HTTPClient(baseURL: "https://\(host)", session: session),
                logger: logger,
                senders: RowSenders.default(logger: logger),
                currentClientId: {
                    onDrainPass?()
                    return currentId.value
                },
                resolveMerchantId: resolveMerchantId ?? { nil },
                signProof: signProof ?? { _, _, _ in nil },
                trackingAllowed: { backend.requests.count < deny.value },
                identityReadable: { readable.value },
                now: { clock.current },
                newKey: { "key-\(keys.increment() - 1)" },
                // Deterministic jitter: the top of the range; a test advancing the clock past
                // the maximum delay always clears the window.
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

        func pending() async -> [QueuedRow] {
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
        #expect(pending.first?.payload.contains("second") == true)
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
        #expect(pending.first?.payload.contains("healthy") == true)
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

    // MARK: - the two bugs this port fixes

    @Test("a nil merchant at track time lands the row with the m key entirely absent (bug 1)")
    func nilMerchantLeavesMAbsentOnDisk() async throws {
        let fixture = Fixture()
        await fixture.tracker.track(merchantId: nil, clientId: Self.clientId, interaction: .custom("cold-start"))
        await fixture.tracker.flush()

        let raw = try String(contentsOf: fixture.fileURL, encoding: .utf8)
        #expect(!raw.contains("\"m\":"))
        let pending = await fixture.pending()
        #expect(pending.first?.merchantId == nil)
    }

    @Test("a merge refused with 503 survives with failures unchanged and arms the backoff (bug 2)")
    func merge503SurvivesWithBackoffArmed() async {
        let fixture = Fixture(signProof: { _, _, _ in "proof" })
        fixture.backend.respond(StubResponse(status: 503, body: ""))
        await fixture.tracker.trackMerge(mergeToken: "token-1", anonymousId: Self.clientId, merchantId: Self.merchantId)
        await fixture.tracker.flush()

        let pending = await fixture.pending()
        #expect(pending.count == 1)
        #expect(pending.first?.failures == 0)
        #expect(pending.first?.idempotencyKey == "token-1")

        // Backoff armed: an immediate second flush must not issue a second request.
        let before = fixture.backend.requests.count
        await fixture.tracker.flush()
        #expect(fixture.backend.requests.count == before)
    }

    @Test("a merge refused three times in a row is dropped via the failure cap")
    func mergeDroppedAfterThreeRejections() async {
        let fixture = Fixture(signProof: { _, _, _ in "proof" })
        fixture.backend.respond(StubResponse(status: 403, body: #"{"code":"PROOF_INVALID"}"#))
        await fixture.tracker.trackMerge(mergeToken: "token-1", anonymousId: Self.clientId, merchantId: Self.merchantId)
        await fixture.tracker.flush()
        for _ in 0..<2 {
            await fixture.tracker.flush()
        }

        let pending = await fixture.pending()
        #expect(pending.isEmpty)
    }

    // MARK: - the durable merge-replay guard

    /// The replay guard keys on kind as well as the token, mirroring Android: a same-named
    /// idempotency key on another kind must not swallow the merge row.
    @Test("a merge is still enqueued when another kind already holds the same idempotency key")
    func replayGuardFiltersByKind() async {
        let fixture = Fixture()
        await fixture.tracker.track(
            merchantId: Self.merchantId,
            clientId: Self.clientId,
            interaction: .custom("x", idempotencyKey: "token-1")
        )

        await fixture.tracker.trackMerge(mergeToken: "token-1", anonymousId: Self.clientId, merchantId: Self.merchantId)

        let pending = await fixture.pending()
        #expect(pending.filter { $0.kind == MergeSender.kind }.count == 1)
    }

    /// The guarantee this port adds: a merge token replayed across a process relaunch, where
    /// `IdentityMerge`'s in-memory `consumed` set is empty again, still enqueues exactly once —
    /// only the disk check (`isQueued`) can catch it the second time.
    @Test("the same merge token arriving twice across two IdentityMerge instances enqueues once")
    func isQueuedSurvivesARelaunch() async {
        let fixture = Fixture(signProof: { _, _, _ in nil })
        let token = "token-1"

        func arrive(_ merge: IdentityMerge) async {
            guard await merge.claim(token) else { return }
            await fixture.tracker.trackMerge(mergeToken: token, anonymousId: Self.clientId, merchantId: Self.merchantId)
        }

        await arrive(IdentityMerge(logger: FrakLogger(level: .none)))
        // A fresh instance: its `consumed` set is empty, exactly like after a relaunch, so only
        // `trackMerge`'s own disk check can catch the replay.
        await arrive(IdentityMerge(logger: FrakLogger(level: .none)))

        let pending = await fixture.pending()
        #expect(pending.filter { $0.idempotencyKey == token }.count == 1)
    }

    // MARK: - hold budget

    @Test("a first hold stamps heldSince once and stops before the row behind it")
    func firstHoldStampsAndStopsFIFO() async {
        let fixture = Fixture()
        await fixture.tracker.trackMerge(mergeToken: "token-1", anonymousId: Self.clientId, merchantId: Self.merchantId)
        await fixture.tracker.track(
            merchantId: Self.merchantId,
            clientId: Self.clientId,
            interaction: .custom("behind")
        )
        await fixture.tracker.flush()

        #expect(fixture.backend.requests.isEmpty)
        let pending = await fixture.pending()
        #expect(pending.count == 2)
        #expect(pending.first?.heldSince != nil)
        #expect(pending.last?.payload.contains("behind") == true)
    }

    @Test("a second hold within budget does not re-stamp heldSince")
    func secondHoldWithinBudgetDoesNotRestamp() async {
        let fixture = Fixture()
        await fixture.tracker.trackMerge(mergeToken: "token-1", anonymousId: Self.clientId, merchantId: Self.merchantId)
        await fixture.tracker.flush()
        let firstStamp = await fixture.pending().first?.heldSince

        fixture.clock.current.addTimeInterval(60)
        await fixture.tracker.flush()
        let secondStamp = await fixture.pending().first?.heldSince

        #expect(firstStamp != nil)
        #expect(firstStamp == secondStamp)
    }

    @Test("a hold past its budget is dropped and the drain continues to the row behind it")
    func holdPastBudgetDropsAndContinues() async throws {
        let fixture = Fixture()
        await fixture.tracker.trackMerge(mergeToken: "token-1", anonymousId: Self.clientId, merchantId: Self.merchantId)
        await fixture.tracker.track(
            merchantId: Self.merchantId,
            clientId: Self.clientId,
            interaction: .custom("behind")
        )
        await fixture.tracker.flush()

        // MergeSender.holdTimeout is 1h; this crosses it while staying far under the 14-day cap.
        fixture.clock.current.addTimeInterval(60 * 60 + 1)
        fixture.backend.respond(StubResponse(status: 200, body: "{}"))
        await fixture.tracker.flush()

        let pending = await fixture.pending()
        #expect(pending.isEmpty)
        let request = try #require(fixture.backend.requests.last)
        #expect(request.stubJSON["customType"] as? String == "behind")
    }

    @Test("MergeSender's 1h hold budget expires before InteractionSender's 24h default")
    func differentHoldBudgetsWithinTheSameDrain() async {
        let fixture = Fixture()
        await fixture.tracker.trackMerge(mergeToken: "token-1", anonymousId: Self.clientId, merchantId: nil)
        await fixture.tracker.track(merchantId: nil, clientId: Self.clientId, interaction: .custom("still-held"))
        await fixture.tracker.flush()

        // Crosses the merge's 1h budget while staying far under the interaction's 24h one.
        fixture.clock.current.addTimeInterval(2 * 60 * 60)
        await fixture.tracker.flush()

        #expect(fixture.backend.requests.isEmpty)
        let pending = await fixture.pending()
        #expect(pending.count == 1)
        #expect(pending.first?.payload.contains("still-held") == true)
        #expect(pending.first?.heldSince != nil)
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

    // MARK: - resolveMerchantId memoisation

    @Test(
        "resolveMerchantId is called at most once per drain; the resolved id reaches the wire but is never written back to disk"
    )
    func resolveMerchantIdMemoisedPerDrain() async throws {
        let calls = Counter()
        let fixture = Fixture(resolveMerchantId: {
            calls.increment()
            return Self.merchantId
        })
        fixture.backend.respondEach([
            StubResponse(status: 200, body: "{}"),
            StubResponse(status: 200, body: "{}"),
            StubResponse(status: 503, body: ""),
        ])
        func unresolvedRow(_ key: String) -> QueuedRow {
            QueuedRow(
                idempotencyKey: key,
                kind: "interaction",
                payload: #"{"type":"custom","interactionType":"\#(key)"}"#,
                clientId: Self.clientId,
                merchantId: nil,
                capturedAt: fixture.clock.current
            )
        }
        await fixture.queue.append(unresolvedRow("first"))
        await fixture.queue.append(unresolvedRow("second"))
        await fixture.queue.append(unresolvedRow("third"))

        await fixture.tracker.flush()

        #expect(calls.value == 1)
        #expect(fixture.backend.requests.count == 3)
        for request in fixture.backend.requests {
            #expect(request.stubJSON["merchantId"] as? String == Self.merchantId)
        }
        let pending = await fixture.pending()
        #expect(pending.count == 1)
        #expect(pending.first?.idempotencyKey == "third")
        #expect(pending.first?.merchantId == nil)
    }

    // MARK: - identity availability

    /// Before a device's first unlock the identity is unreadable, so `currentClientId` is nil —
    /// and the stale-id guard reads `if let captured, let currentId`, so a nil current id
    /// DISABLES it rather than tightening it. Draining then posts rows for an identity the user
    /// may already have reset. The gate returns before the read, leaving the file untouched.
    @Test("a drain is skipped, and the queue left byte-identical, while the identity is unreadable")
    func unreadableIdentitySkipsTheDrain() async throws {
        let fixture = Fixture()
        // Set before the first capture: a successful drain DELETES the queue file, so flushing
        // first and comparing afterwards would compare against nothing.
        fixture.identityReadable.value = false
        await fixture.tracker.track(
            merchantId: Self.merchantId,
            clientId: Self.clientId,
            interaction: .custom("locked")
        )
        let queued = try Data(contentsOf: fixture.fileURL)

        await fixture.tracker.flush()

        #expect(fixture.backend.requests.isEmpty)
        #expect(try Data(contentsOf: fixture.fileURL) == queued)

        // First unlock: the same row goes out, unchanged, with no further prompting.
        fixture.identityReadable.value = true
        await fixture.tracker.flush()
        #expect(fixture.backend.requests.count == 1)
    }

    // MARK: - cancellation

    @Test("a cancelled drain leaves the queue file byte-identical (no reconcile)")
    func cancelledDrainLeavesTheFileUntouched() async throws {
        // Appended directly, not via `track`, so both rows are on disk before the drain ever
        // starts: two separate `track` calls can race their own detached drains, letting the
        // first settle (and reconcile away) before the second is even appended.
        //
        // First row must actually be delivered before the second hangs: with nothing already
        // reconciled this pass, `break` and `return` write the same (empty) diff, so a one-row
        // version of this test cannot tell them apart.
        let backend = FirstSucceedsThenHangsBackend()
        let (session, host) = StubURLProtocol.makeSession()
        defer { StubURLProtocol.reset(host: host) }
        StubURLProtocol.handle(host: host) { try backend.handle($0) }

        let fileURL =
            FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
            .appendingPathComponent(EventQueue.fileName)
        let logger = FrakLogger(level: .none)
        let queue = EventQueue(fileURL: fileURL, logger: logger)
        let tracker = EventOutbox(
            queue: queue,
            http: HTTPClient(baseURL: "https://\(host)", session: session),
            logger: logger,
            senders: RowSenders.default(logger: logger),
            currentClientId: { Self.clientId },
            resolveMerchantId: { nil },
            signProof: { _, _, _ in nil }
        )
        func row(_ key: String) -> QueuedRow {
            QueuedRow(
                idempotencyKey: key,
                kind: InteractionSender.kind,
                payload: #"{"type":"custom","interactionType":"\#(key)"}"#,
                clientId: Self.clientId,
                merchantId: Self.merchantId,
                capturedAt: Date()
            )
        }
        await queue.append(row("first"))
        await queue.append(row("second"))

        let flushTask = Task { await tracker.flush() }
        var waited = 0
        while !backend.hasSeenSecond, waited < 200 {
            try await Task.sleep(nanoseconds: 5_000_000)
            waited += 1
        }
        try #require(backend.hasSeenSecond)
        let beforeCancel = try Data(contentsOf: fileURL)
        let beforeText = String(decoding: beforeCancel, as: UTF8.self)
        #expect(beforeText.contains("first"))
        #expect(beforeText.contains("second"))

        await tracker.shutdown()
        await flushTask.value

        let afterCancel = try Data(contentsOf: fileURL)
        #expect(afterCancel == beforeCancel)
    }

    /// Delivers its first request immediately, then hangs on every request after, so a drain can
    /// be caught with one row already reconciled-worthy and a second mid-flight.
    private final class FirstSucceedsThenHangsBackend: @unchecked Sendable {
        private let lock = NSLock()
        private var seenSecond = false
        private let count = Counter()

        func handle(_ request: URLRequest) throws -> StubResponse {
            guard count.increment() > 1 else {
                return StubResponse(status: 200, body: "{}")
            }
            lock.lock()
            seenSecond = true
            lock.unlock()
            throw StubHangs()
        }

        var hasSeenSecond: Bool {
            lock.lock()
            defer { lock.unlock() }
            return seenSecond
        }
    }

    // MARK: - drain coalescing

    /// Blocks its first-ever request until released, on the calling (non-cooperative) thread, so
    /// a burst fired while a drain is in flight is guaranteed to land before that drain's next pass.
    private final class GatedBackend: @unchecked Sendable {
        private let lock = NSLock()
        private var released = false
        private var seenFirst = false
        let requests = RequestLog()

        func handle(_ request: URLRequest) throws -> StubResponse {
            requests.record(request)
            if requests.count == 1 {
                lock.lock()
                seenFirst = true
                lock.unlock()
                while true {
                    lock.lock()
                    let done = released
                    lock.unlock()
                    if done { break }
                    Thread.sleep(forTimeInterval: 0.005)
                }
            }
            return StubResponse(status: 200, body: "{}")
        }

        func release() {
            lock.lock()
            released = true
            lock.unlock()
        }

        var hasSeenFirst: Bool {
            lock.lock()
            defer { lock.unlock() }
            return seenFirst
        }
    }

    @Test("a burst of tracks that lands while a drain is in flight settles in at most two passes")
    func burstDuringAnInFlightDrainCoalesces() async throws {
        let gated = GatedBackend()
        let (session, host) = StubURLProtocol.makeSession()
        defer { StubURLProtocol.reset(host: host) }
        StubURLProtocol.handle(host: host) { try gated.handle($0) }

        let fileURL =
            FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
            .appendingPathComponent(EventQueue.fileName)
        let logger = FrakLogger(level: .none)
        let queue = EventQueue(fileURL: fileURL, logger: logger)
        let passes = Counter()
        let tracker = EventOutbox(
            queue: queue,
            http: HTTPClient(baseURL: "https://\(host)", session: session),
            logger: logger,
            senders: RowSenders.default(logger: logger),
            currentClientId: {
                passes.increment()
                return Self.clientId
            },
            resolveMerchantId: { nil },
            signProof: { _, _, _ in nil }
        )

        await tracker.track(merchantId: Self.merchantId, clientId: Self.clientId, interaction: .custom("first"))
        var waited = 0
        while !gated.hasSeenFirst, waited < 200 {
            try await Task.sleep(nanoseconds: 5_000_000)
            waited += 1
        }
        try #require(gated.hasSeenFirst)

        // Lands entirely while the first pass is still blocked on its only request.
        await withTaskGroup(of: Void.self) { group in
            for index in 0..<10 {
                group.addTask {
                    await tracker.track(
                        merchantId: Self.merchantId,
                        clientId: Self.clientId,
                        interaction: .custom("burst-\(index)")
                    )
                }
            }
        }

        gated.release()
        await tracker.flush()

        #expect(gated.requests.count == 11)
        #expect(passes.value <= 2)
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

    @Test("flush survives a failed migration rewrite instead of wiping the queue (2-7,critical)")
    func flushSurvivesAFailedMigrationRewrite() async throws {
        let fixture = Fixture()

        // Every current field except "r", which never existed. Written directly, bypassing
        // append/track, exactly like an install upgrading in place.
        try FileManager.default.createDirectory(
            at: fixture.fileURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        var lines = ""
        for (key, capturedAt) in [("old-a", 1_709_654_399.0), ("old-b", 1_709_654_400.0)] {
            let object: [String: Any] = [
                "k": key,
                "kind": "interaction",
                // A JSON *string*, not a nested object: QueuedRow.payload is typed String (the
                // request body is pre-serialised at capture time).
                "payload": #"{"type":"sharing","merchantId":"\#(Self.merchantId)"}"#,
                "c": Self.clientId,
                "t": Int64((capturedAt * 1000).rounded()),
                "f": 0,
            ]
            let data = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
            lines += String(decoding: data, as: UTF8.self) + "\n"
        }
        try Data(lines.utf8).write(to: fixture.fileURL, options: .atomic)

        // Forces EventQueue.replace's write to fail during the migration read inside flush: a
        // read-only parent directory blocks the atomic write/rename, while fixture.fileURL
        // itself stays readable.
        // Mode bits are ignored for the superuser, so a root runner would write successfully,
        // producing a false failure rather than the behavior this test pins.
        try #require(getuid() != 0, "needs a non-root runner: 0o500 does not block root's write")
        let parent = fixture.fileURL.deletingLastPathComponent()
        try FileManager.default.setAttributes([.posixPermissions: 0o500], ofItemAtPath: parent.path)
        // defer, not a trailing restore: an #expect that throws below must not leave the temp
        // directory unwritable for the rest of the suite.
        defer { try? FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: parent.path) }

        fixture.backend.respond(StubResponse(status: 200, body: #"{"success":true}"#))
        await fixture.tracker.flush()

        try FileManager.default.setAttributes([.posixPermissions: 0o700], ofItemAtPath: parent.path)
        let survivors = await fixture.pending()
        #expect(survivors.map(\.idempotencyKey) == ["old-a", "old-b"])
    }

    /// Consent withdrawn mid-drain must stop before the next POST: the drain already holds
    /// every event in memory, so purging the file alone can't stop it. Withdrawal also nils
    /// `currentClientId`, which disables the stale-id guard rather than tightening it.
    ///
    /// The queue is seeded directly rather than through `track`, since `track` schedules one
    /// drain per call — routed through it, each drain would hold exactly one event and the
    /// mid-drain window wouldn't exist to test.
    @Test("stops mid-drain when consent is withdrawn, and keeps the unsent events")
    func stopsMidDrainOnWithdrawal() async throws {
        let fixture = Fixture()
        fixture.backend.respond(StubResponse(status: 200, body: "{}"))
        await fixture.queue.append(Self.seeded("key-first", type: "first", at: fixture.clock.current))
        await fixture.queue.append(Self.seeded("key-second", type: "second", at: fixture.clock.current))
        // Withdrawn the instant the first event lands on the wire, i.e. between the two POSTs.
        fixture.denyTrackingAfterRequests.value = 1

        await fixture.tracker.flush()

        #expect(fixture.backend.requests.count == 1)
        // Reconciled, not abandoned: the delivered event is removed even though the drain
        // stopped early. The undelivered one survives — withdrawal is a pause, not an erasure.
        let survivors = await fixture.pending()
        #expect(survivors.map(\.idempotencyKey) == ["key-second"])
    }

    private static func seeded(_ key: String, type: String, at capturedAt: Date) -> QueuedRow {
        QueuedRow(
            idempotencyKey: key,
            kind: "interaction",
            payload: #"{"type":"custom","interactionType":"\#(type)"}"#,
            clientId: EventOutboxTests.clientId,
            merchantId: EventOutboxTests.merchantId,
            capturedAt: capturedAt
        )
    }

    // MARK: - unmintable proof (bug: must hold, never reject)

    @Test("an unmintable merge proof holds rather than rejects, and never spends the failure cap")
    func mergeNilProofHoldsNeverRejects() async {
        let fixture = Fixture(signProof: { _, _, _ in nil })
        await fixture.tracker.trackMerge(mergeToken: "token-1", anonymousId: Self.clientId, merchantId: Self.merchantId)
        await fixture.tracker.flush()

        for _ in 0..<3 {
            await fixture.tracker.flush()
        }

        // A locked enclave never reaches the network at all; a `.rejected` regression would
        // still show up here as a dropped row once the failure cap is spent.
        #expect(fixture.backend.requests.isEmpty)
        let pending = await fixture.pending()
        #expect(pending.count == 1)
        #expect(pending.first?.failures == 0)
        #expect(pending.first?.heldSince != nil)
    }

    // MARK: - drain-time foreign-merchant arrival guard (closes finding 3.2's iOS half)

    @Test(
        "drops a cold-cache arrival once the drain resolves a merchant that disagrees with the referrer, without breaking FIFO"
    )
    func dropsAColdCacheForeignArrivalAndContinuesFIFO() async {
        let fixture = Fixture(resolveMerchantId: { Self.merchantId })
        // Captured with no merchant yet on file: only the drain's resolve can compare it
        // against the referrer.
        await fixture.tracker.track(
            merchantId: nil,
            clientId: Self.clientId,
            interaction: .arrival(referrerMerchantId: "other-merchant")
        )
        await fixture.tracker.track(
            merchantId: Self.merchantId,
            clientId: Self.clientId,
            interaction: .custom("behind")
        )
        await fixture.tracker.flush()

        // Only "behind" reached the wire. A `.hold`/`.retryable`/`.rejected` outcome would have
        // stopped the pass right there; only `.dropped` lets the row behind it still send in
        // the same pass, which is the observable proof this routed through `.dropped`.
        #expect(fixture.backend.requests.count == 1)
        #expect(fixture.backend.requests.first?.stubJSON["customType"] as? String == "behind")
        let pending = await fixture.pending()
        #expect(pending.isEmpty)
    }

    // MARK: - merge proof, minted fresh on every attempt

    @Test("a merge proof is minted fresh on every delivery attempt, never cached across drains")
    func mergeMintsFreshProofAcrossDrains() async {
        let signCalls = Counter()
        let fixture = Fixture(signProof: { _, _, _ in
            signCalls.increment()
            return "proof"
        })
        let seeded = QueuedRow(
            idempotencyKey: "token-1",
            kind: MergeSender.kind,
            payload: "{}",
            clientId: Self.clientId,
            merchantId: Self.merchantId,
            capturedAt: fixture.clock.current
        )
        await fixture.queue.append(seeded)
        fixture.backend.respond(StubResponse(status: 503, body: ""))

        await fixture.tracker.flush()
        #expect(signCalls.value == 1)

        // Row on disk between the two attempts: no cached proof field exists to check, so the
        // proof is unchanged, and every fact about the row is untouched by the transient failure.
        let between = await fixture.pending()
        #expect(between.count == 1)
        #expect(between.first?.idempotencyKey == "token-1")
        #expect(between.first?.clientId == Self.clientId)
        #expect(between.first?.merchantId == Self.merchantId)
        #expect(between.first?.payload == "{}")
        #expect(between.first?.failures == 0)
        #expect(between.first?.heldSince == nil)

        fixture.advancePastBackoff()
        fixture.backend.respond(StubResponse(status: 200, body: "{}"))
        await fixture.tracker.flush()

        #expect(signCalls.value == 2)
        let after = await fixture.pending()
        #expect(after.isEmpty)
    }
}
