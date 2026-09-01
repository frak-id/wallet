import Foundation
import Testing

@testable import FrakSDK

@Suite("MerchantIdentity")
struct MerchantIdentityTests {
    private static let merchantId = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
    private static let resolveBody = """
        {"merchantId":"\(merchantId)","name":"Acme","domain":"acme.example"}
        """

    private struct Harness {
        let merchantIdentity: MerchantIdentity
        let identity: AnonymousIdStore
        let configStore: ConfigStore
        let requests: RequestLog
        let host: String
    }

    private func makeHarness(
        config: FrakConfig = FrakConfig(merchantId: MerchantIdentityTests.merchantId),
        trackingEnabled: Bool = true,
        respond: @escaping @Sendable (URLRequest) throws -> StubResponse
    ) -> Harness {
        let (session, host) = StubURLProtocol.makeSession()
        let requests = RequestLog()
        StubURLProtocol.handle(host: host) { request in
            requests.record(request)
            return try respond(request)
        }
        let logger = FrakLogger(level: .none)
        let values = InMemoryKeyValueStore()
        let consent = TrackingConsent(store: values, configDefault: trackingEnabled, logger: logger)
        let identity = AnonymousIdStore(
            keyStore: FakeDeviceKeyStore(),
            store: values,
            logger: logger,
            merchantMarker: config.merchantId ?? "",
            consent: consent
        )
        let http = HTTPClient(baseURL: "https://\(host)", session: session, logger: logger)
        let configStore = ConfigStore(http: http, store: InMemoryKeyValueStore(), logger: logger)
        return Harness(
            merchantIdentity: MerchantIdentity(
                settings: config,
                identity: identity,
                configStore: configStore,
                logger: logger
            ),
            identity: identity,
            configStore: configStore,
            requests: requests,
            host: host
        )
    }

    @Test("required returns the configured merchantId without touching the network")
    func requiredReturnsConfiguredMerchantId() async throws {
        let harness = makeHarness { _ in
            Issue.record("a configured merchantId must not resolve over the network")
            return StubResponse(status: 500, body: "")
        }
        defer { StubURLProtocol.reset(host: harness.host) }

        let merchantId = try await harness.merchantIdentity.merchant(.required)
        #expect(merchantId == Self.merchantId)
    }

    @Test("required resolves over the network when unset, and throws on failure")
    func requiredResolvesAndThrows() async throws {
        let config = FrakConfig(bundleId: "com.acme.app")
        let harness = makeHarness(config: config) { _ in StubResponse(status: 404, body: "not found") }
        defer { StubURLProtocol.reset(host: harness.host) }

        await #expect(throws: FrakError.self) {
            _ = try await harness.merchantIdentity.merchant(.required)
        }
    }

    @Test("optional returns the configured merchantId without touching the network")
    func optionalPrefersConfiguredMerchantId() async throws {
        let harness = makeHarness { _ in StubResponse(status: 200, body: Self.resolveBody) }
        defer { StubURLProtocol.reset(host: harness.host) }

        let merchantId = try await harness.merchantIdentity.merchant(.optional)
        #expect(merchantId == Self.merchantId)
        // A resolve here would be discarded anyway, since settings.merchantId wins over it.
        #expect(harness.requests.count == 0)
    }

    @Test("optional swallows a resolve failure to nil")
    func optionalSwallowsResolveFailure() async throws {
        let config = FrakConfig(bundleId: "com.acme.app")
        let harness = makeHarness(config: config) { _ in StubResponse(status: 404, body: "not found") }
        defer { StubURLProtocol.reset(host: harness.host) }

        let merchantId = try await harness.merchantIdentity.merchant(.optional)
        #expect(merchantId == nil)
    }

    @Test("optional propagates cancellation instead of swallowing it to nil")
    func optionalPropagatesCancellation() async throws {
        let config = FrakConfig(bundleId: "com.acme.app")
        let harness = makeHarness(config: config) { _ in throw StubHangs() }
        defer { StubURLProtocol.reset(host: harness.host) }

        let task = Task {
            try await harness.merchantIdentity.merchant(.optional)
        }
        try await Task.sleep(nanoseconds: 50_000_000)
        task.cancel()

        await #expect(throws: CancellationError.self) {
            _ = try await task.value
        }
    }

    @Test("cachedOnly never touches the network")
    func cachedOnlyNeverTouchesTheNetwork() async throws {
        let config = FrakConfig(bundleId: "com.acme.app")
        let harness = makeHarness(config: config) { _ in
            Issue.record("cachedOnly must never issue a request")
            return StubResponse(status: 500, body: "")
        }
        defer { StubURLProtocol.reset(host: harness.host) }

        let merchantId = try await harness.merchantIdentity.merchant(.cachedOnly)
        #expect(merchantId == nil)
        #expect(harness.requests.count == 0)
    }

    @Test("cachedOnly reads a warm cache without resolving")
    func cachedOnlyReadsAWarmCache() async throws {
        let config = FrakConfig(bundleId: "com.acme.app")
        let harness = makeHarness(config: config) { _ in StubResponse(status: 200, body: Self.resolveBody) }
        defer { StubURLProtocol.reset(host: harness.host) }

        _ = try await harness.merchantIdentity.merchant(.required)
        let before = harness.requests.count

        let merchantId = try await harness.merchantIdentity.merchant(.cachedOnly)
        #expect(merchantId == Self.merchantId)
        #expect(harness.requests.count == before, "cachedOnly must not issue a request even on a warm cache")
    }

    @Test("pair returns nil when the anonymous id is missing")
    func pairReturnsNilWithoutAnonymousId() async throws {
        let harness = makeHarness(trackingEnabled: false) { _ in StubResponse(status: 200, body: Self.resolveBody) }
        defer { StubURLProtocol.reset(host: harness.host) }

        let pair = try await harness.merchantIdentity.pair(.optional)
        #expect(pair == nil)
        #expect(harness.requests.count == 0, "the merchant must not resolve when there is no identity to pair it with")
    }

    @Test("pair returns nil when the merchant is missing")
    func pairReturnsNilWithoutMerchant() async throws {
        let config = FrakConfig(bundleId: "com.acme.app")
        let harness = makeHarness(config: config) { _ in StubResponse(status: 404, body: "not found") }
        defer { StubURLProtocol.reset(host: harness.host) }

        let pair = try await harness.merchantIdentity.pair(.optional)
        #expect(pair == nil)
    }

    @Test("pair returns the merchantId/anonymousId pair when both are available")
    func pairReturnsBothHalves() async throws {
        let harness = makeHarness { _ in StubResponse(status: 200, body: Self.resolveBody) }
        defer { StubURLProtocol.reset(host: harness.host) }

        let anonymousId = try #require(await harness.identity.anonymousId())
        let pair = try await harness.merchantIdentity.pair(.required)
        #expect(pair?.merchantId == Self.merchantId)
        #expect(pair?.anonymousId == anonymousId)
    }
}
