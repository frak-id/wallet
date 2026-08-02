import Foundation
import Testing

@testable import FrakSDK

@Suite("DefaultFrakClient")
struct FrakClientTests {
    private static let merchantId = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
    private static let resolveBody = """
        {"merchantId":"\(merchantId)","productId":"0x00","name":"Acme",
         "domain":"acme.example","allowedDomains":["acme.example"]}
        """
    private static let rewardsBody = #"{"rewards":[]}"#

    private func makeClient(
        config: FrakConfig = FrakConfig(merchantId: FrakClientTests.merchantId),
        respond: @escaping @Sendable (URLRequest) throws -> StubResponse
    ) -> DefaultFrakClient {
        let (session, host) = StubURLProtocol.makeSession()
        StubURLProtocol.handle(host: host, respond)
        return DefaultFrakClient(
            config: config,
            store: InMemoryKeyValueStore(),
            logger: FrakLogger(level: .none),
            session: session,
            backendURL: "https://\(host)"
        )
    }

    @Test("resolveConfig resolves the merchant and updates currentConfig")
    func resolveConfigUpdatesCurrentConfig() async throws {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }

        let resolved = try await client.resolveConfig(forceRefresh: false)
        #expect(resolved.merchantId == Self.merchantId)

        let current = await client.currentConfig
        #expect(current?.merchantId == Self.merchantId)
    }

    @Test("configUpdates replays the latest config to a new subscriber")
    func configUpdatesReplaysLatestConfig() async throws {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }
        _ = try await client.resolveConfig(forceRefresh: false)

        var iterator = await client.configUpdates.makeAsyncIterator()
        let first = await iterator.next()
        #expect(first?.merchantId == Self.merchantId)
    }

    @Test("configUpdates conflates: a stalled consumer sees only the newest value")
    func configUpdatesConflatesForAStalledConsumer() async throws {
        let responses = Counter()
        let client = makeClient { _ in
            let n = responses.increment()
            return StubResponse(
                status: 200,
                body: #"{"merchantId":"\#(Self.merchantId)","productId":"0x00","name":"Acme-\#(n)","#
                    + #""domain":"acme.example","allowedDomains":["acme.example"]}"#
            )
        }

        var iterator = await client.configUpdates.makeAsyncIterator()

        _ = try await client.resolveConfig(forceRefresh: true)
        _ = try await client.resolveConfig(forceRefresh: true)
        _ = try await client.resolveConfig(forceRefresh: true)

        let received = await iterator.next()
        #expect(received?.name == "Acme-3")
    }

    @Test("configUpdates does not repeat an unchanged config on a cache-hit resolve")
    func configUpdatesDedupesCacheHitResolve() async throws {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }
        _ = try await client.resolveConfig(forceRefresh: false)

        let received = ConfigLog()
        let subscriber = Task {
            for await config in await client.configUpdates {
                await received.append(config)
            }
        }
        try await Task.sleep(nanoseconds: 20_000_000)

        // Same body: a cache hit at the store, no actual change.
        _ = try await client.resolveConfig(forceRefresh: false)
        try await Task.sleep(nanoseconds: 50_000_000)

        subscriber.cancel()
        #expect(await received.values.count == 1)
    }

    @Test("configUpdates emits again when the config actually changes")
    func configUpdatesEmitsOnGenuineChange() async throws {
        let responses = Counter()
        let client = makeClient { _ in
            let n = responses.increment()
            let name = n == 1 ? "Acme" : "Acme Renamed"
            return StubResponse(
                status: 200,
                body: #"{"merchantId":"\#(Self.merchantId)","productId":"0x00","name":"\#(name)","#
                    + #""domain":"acme.example","allowedDomains":["acme.example"]}"#
            )
        }
        _ = try await client.resolveConfig(forceRefresh: false)

        let received = ConfigLog()
        let subscriber = Task {
            for await config in await client.configUpdates {
                await received.append(config)
            }
        }
        try await Task.sleep(nanoseconds: 20_000_000)

        _ = try await client.resolveConfig(forceRefresh: true)
        try await Task.sleep(nanoseconds: 50_000_000)

        subscriber.cancel()
        let names = await received.values.map(\.name)
        #expect(names == ["Acme", "Acme Renamed"])
    }

    @Test("configUpdates multicasts to more than one subscriber")
    func configUpdatesMulticastsToMultipleSubscribers() async throws {
        let client = makeClient { _ in StubResponse(status: 200, body: Self.resolveBody) }
        _ = try await client.resolveConfig(forceRefresh: false)

        var firstIterator = await client.configUpdates.makeAsyncIterator()
        var secondIterator = await client.configUpdates.makeAsyncIterator()

        #expect(await firstIterator.next()?.merchantId == Self.merchantId)
        #expect(await secondIterator.next()?.merchantId == Self.merchantId)
    }

    @Test("campaigns resolves the merchant first, so a bad merchant id fails clearly")
    func campaignsResolvesMerchantFirst() async throws {
        let client = makeClient { request in
            guard let path = request.url?.path, path.contains("resolve") else {
                Issue.record("rewards should not be requested before resolve succeeds")
                return StubResponse(status: 500, body: "")
            }
            return StubResponse(status: 404, body: "Merchant not found")
        }

        await #expect(throws: FrakError.self) {
            _ = try await client.campaigns(forceRefresh: false)
        }
    }

    @Test("bestReward reads currency from config, not a caller parameter")
    func bestRewardReadsCurrencyFromConfig() async throws {
        let log = RequestLog()
        let config = FrakConfig(merchantId: Self.merchantId, metadata: FrakMetadata(currency: .usd))
        let client = makeClient(config: config) { request in
            log.record(request)
            if request.url?.path.contains("resolve") == true {
                return StubResponse(status: 200, body: Self.resolveBody)
            }
            return StubResponse(status: 200, body: Self.rewardsBody)
        }

        _ = try await client.bestReward(targetInteraction: nil, audience: nil, forceRefresh: false)

        #expect(log.urls.contains { $0.contains("currency=usd") })
    }

    @Test("trackingEnabled false throws trackingDisabled without a network call")
    func trackingDisabledThrowsWithoutNetworkCall() async throws {
        let log = RequestLog()
        let config = FrakConfig(merchantId: Self.merchantId, trackingEnabled: false)
        let client = makeClient(config: config) { request in
            log.record(request)
            return StubResponse(status: 200, body: Self.resolveBody)
        }

        await #expect(throws: FrakError.self) {
            _ = try await client.resolveConfig(forceRefresh: false)
        }
        #expect(log.all.isEmpty)
    }

    @Test("the three facade methods have usable defaults through any FrakClient")
    func facadeMethodsHaveDefaultsThroughTheProtocol() async throws {
        let client: any FrakClient = makeClient { request in
            if request.url?.path.contains("resolve") == true {
                return StubResponse(status: 200, body: Self.resolveBody)
            }
            return StubResponse(status: 200, body: Self.rewardsBody)
        }

        // Only compiles if the protocol extension's defaults apply to
        // `any FrakClient`, not just the concrete type. The last call is the one
        // `Frak`'s own documentation shows.
        _ = try await client.resolveConfig()
        _ = try await client.campaigns()
        _ = try await client.bestReward()
        _ = try await client.bestReward(targetInteraction: "purchase")
    }
}
