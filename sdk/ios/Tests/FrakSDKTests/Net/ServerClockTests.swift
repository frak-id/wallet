import Foundation
import Testing

@testable import FrakSDK

private final class RecordingLogSink: FrakLogSink, @unchecked Sendable {
    private let lock = NSLock()
    private var captured: [String] = []

    func log(level: FrakLogLevel, message: String, error: (any Error)?) {
        lock.lock()
        defer { lock.unlock() }
        captured.append(message)
    }

    var messages: [String] {
        lock.lock()
        defer { lock.unlock() }
        return captured
    }
}

@Suite("ServerClock")
struct ServerClockTests {
    private let device = Clock()

    init() {
        device.current = Date(timeIntervalSince1970: 1_770_000_000)
    }

    private func makeClock(logger: FrakLogger? = nil) -> ServerClock {
        let device = device
        return ServerClock(now: { device.current }, logger: logger)
    }

    @Test("reads the device clock until a response says otherwise")
    func readsTheDeviceClockUntilObserved() {
        #expect(makeClock().nowSeconds() == 1_770_000_000)
    }

    @Test("corrects a device running fast")
    func correctsAFastDevice() {
        let clock = makeClock()
        clock.observe(Date(timeIntervalSince1970: 1_770_000_000 - 90))

        #expect(clock.nowSeconds() == 1_770_000_000 - 90)
    }

    @Test("keeps advancing with the device once corrected")
    func keepsAdvancingWithTheDevice() {
        let clock = makeClock()
        clock.observe(Date(timeIntervalSince1970: 1_770_000_000 - 90))
        device.current = Date(timeIntervalSince1970: 1_770_000_010)

        #expect(clock.nowSeconds() == 1_770_000_010 - 90)
    }

    @Test("ignores an absent or implausible Date header")
    func ignoresAbsentOrImplausibleDates() {
        let clock = makeClock()
        clock.observe(nil)
        clock.observe(Date(timeIntervalSince1970: 1_000_000_000))
        clock.observe(Date(timeIntervalSince1970: 4_200_000_000))

        #expect(clock.nowSeconds() == 1_770_000_000)
    }

    @Test("warns once when the device is 30 s or more off, and not for a small drift")
    func warnsOnceOnLargeDrift() {
        let sink = RecordingLogSink()
        let clock = makeClock(logger: FrakLogger(level: .warn, sink: sink))

        clock.observe(Date(timeIntervalSince1970: 1_770_000_000 - 29))
        #expect(sink.messages.isEmpty)

        clock.observe(Date(timeIntervalSince1970: 1_770_000_000 - 90))
        clock.observe(Date(timeIntervalSince1970: 1_770_000_000 - 95))
        #expect(sink.messages.count == 1)
    }
}

@Suite("Server clock wiring")
struct ServerClockWiringTests {
    private static let merchantId = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"
    // Thu, 23 Oct 2026 15:07:53 GMT
    private static let serverSeconds: Int64 = 1_792_768_073

    private func makeHTTP(
        clock: ServerClock,
        _ handler: @escaping @Sendable (URLRequest) throws -> StubResponse
    ) -> HTTPClient {
        let (session, host) = StubURLProtocol.makeSession()
        StubURLProtocol.handle(host: host, handler)
        return HTTPClient(baseURL: "https://\(host)", session: session, serverClock: clock)
    }

    private func makeIdentity(clock: ServerClock) -> AnonymousIdStore {
        let logger = FrakLogger(level: .none)
        let values = InMemoryKeyValueStore()
        return AnonymousIdStore(
            keyStore: FakeDeviceKeyStore(),
            store: values,
            logger: logger,
            merchantMarker: Self.merchantId,
            consent: TrackingConsent(store: values, configDefault: true, logger: logger),
            serverClock: clock
        )
    }

    /// `ts` is the big-endian uint64 right after the version byte and the 65-byte public key.
    private func timestamp(of proof: String) throws -> Int64 {
        let envelope = try #require(Base64URL.decode(proof))
        let start = 1 + ProofCodec.publicKeyBytes
        return envelope[start..<(start + 8)].reduce(0) { ($0 << 8) | Int64($1) }
    }

    @Test("a proof is stamped with the server time learned from a response, not the device's")
    func proofCarriesServerTime() async throws {
        let device = Date(timeIntervalSince1970: TimeInterval(Self.serverSeconds + 90))
        let clock = ServerClock(now: { device })
        let http = makeHTTP(clock: clock) { _ in
            StubResponse(status: 200, body: "{}", headers: ["Date": "Thu, 23 Oct 2026 15:07:53 GMT"])
        }
        let identity = makeIdentity(clock: clock)

        _ = try await http.get("/user/merchant/resolve")
        let proof = try #require(await identity.signProof(.install, merchantId: Self.merchantId))

        #expect(try timestamp(of: proof) == Self.serverSeconds)
    }

    @Test("an explicit timestamp still wins over the clock")
    func explicitTimestampWins() async throws {
        let identity = makeIdentity(clock: ServerClock())

        let proof = try #require(await identity.signProof(.install, merchantId: Self.merchantId, ts: 1_700_000_000))

        #expect(try timestamp(of: proof) == 1_700_000_000)
    }

    @Test("an error response corrects the clock too")
    func errorResponsesCountToo() async throws {
        let device = Date(timeIntervalSince1970: TimeInterval(Self.serverSeconds + 90))
        let clock = ServerClock(now: { device })
        let http = makeHTTP(clock: clock) { _ in
            StubResponse(status: 503, body: "{}", headers: ["Date": "Thu, 23 Oct 2026 15:07:53 GMT"])
        }

        _ = try await http.get("/user/merchant/resolve")

        #expect(clock.nowSeconds() == Self.serverSeconds)
    }

    @Test("a response without a parseable Date header leaves the clock alone")
    func unparseableDateIsIgnored() async throws {
        let device = Date(timeIntervalSince1970: TimeInterval(Self.serverSeconds + 90))
        let clock = ServerClock(now: { device })
        let http = makeHTTP(clock: clock) { _ in
            StubResponse(status: 200, body: "{}", headers: ["Date": "yesterday, around noon"])
        }

        _ = try await http.get("/user/merchant/resolve")

        #expect(clock.nowSeconds() == Self.serverSeconds + 90)
    }

    @Test("a merge rejected for a fast device clock succeeds on the next drain, re-signed with the server's time")
    func fastClockMergeHealsOnNextDrain() async throws {
        let device = Date(timeIntervalSince1970: TimeInterval(Self.serverSeconds + 120))
        let clock = ServerClock(now: { device })
        let requests = RequestLog()
        let http = makeHTTP(clock: clock) { request in
            requests.record(request)
            let headers = ["Date": "Fri, 23 Oct 2026 15:07:53 GMT"]
            guard let proof = request.stubJSON["proof"] as? String else { throw URLError(.cannotParseResponse) }
            if try timestamp(of: proof) > Self.serverSeconds + 60 {
                return StubResponse(status: 403, body: #"{"code":"PROOF_INVALID"}"#, headers: headers)
            }
            return StubResponse(status: 200, body: #"{"finalGroupId":"g-1","merged":true}"#, headers: headers)
        }
        let identity = makeIdentity(clock: clock)
        let anonymousId = try #require(await identity.anonymousId())
        let logger = FrakLogger(level: .none)
        let queue = EventQueue(
            fileURL: FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString, isDirectory: true)
                .appendingPathComponent(EventQueue.fileName),
            logger: logger
        )
        let outbox = EventOutbox(
            queue: queue,
            http: http,
            logger: logger,
            senders: RowSenders.default(logger: logger),
            currentClientId: { await identity.anonymousId() },
            resolveMerchantId: { nil },
            signProof: { op, merchantId, binding in
                await identity.signProof(op, merchantId: merchantId, binding: binding)
            }
        )
        await queue.append(
            QueuedRow(
                idempotencyKey: "merge-token-1",
                kind: MergeSender.kind,
                payload: "{}",
                clientId: anonymousId,
                merchantId: Self.merchantId,
                capturedAt: Date()
            )
        )

        await outbox.flush()

        try #require(requests.count == 1)
        #expect(try timestamp(of: #require(requests.all[0].stubJSON["proof"] as? String)) == Self.serverSeconds + 120)
        #expect(await queue.read(now: Date()).count == 1)

        await outbox.flush()

        try #require(requests.count == 2)
        let healed = try timestamp(of: #require(requests.all[1].stubJSON["proof"] as? String))
        #expect(abs(healed - Self.serverSeconds) <= 2)
        #expect(await queue.read(now: Date()).isEmpty)
    }
}
