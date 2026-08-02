import Foundation
import Testing

@testable import FrakSDK

@Suite("ConfigStore")
struct ConfigStoreTests {
    private static let merchantId = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
    private static let body = """
        {"merchantId":"\(merchantId)","productId":"0x00","name":"Acme",
         "domain":"acme.example","allowedDomains":["acme.example"]}
        """

    private func makeStore(
        clock: Clock,
        log: RequestLog,
        respond: @escaping @Sendable (URLRequest) throws -> StubResponse
    ) -> ConfigStore {
        let (session, host) = StubURLProtocol.makeSession()
        StubURLProtocol.handle(host: host) { request in
            log.record(request)
            return try respond(request)
        }
        let http = HTTPClient(baseURL: "https://\(host)", session: session)
        return ConfigStore(
            http: http,
            store: InMemoryKeyValueStore(),
            logger: FrakLogger(level: .none),
            now: { clock.current }
        )
    }

    private func query() throws -> MerchantQuery {
        try MerchantQuery.from(FrakConfig(merchantId: Self.merchantId))
    }

    @Test("a fresh cache is served without a network call")
    func freshCacheServedWithoutNetwork() async throws {
        let clock = Clock()
        let log = RequestLog()
        let store = makeStore(clock: clock, log: log) { _ in StubResponse(status: 200, body: Self.body) }
        _ = try await store.resolve(query(), forceRefresh: false)
        clock.current.addTimeInterval(ConfigStore.freshTTL - 1)
        _ = try await store.resolve(query(), forceRefresh: false)

        #expect(log.count == 1)
    }

    @Test("a stale cache is served immediately and revalidated in the background")
    func staleCacheServedAndRevalidated() async throws {
        let clock = Clock()
        let log = RequestLog()
        let renamedBody = Self.body.replacingOccurrences(of: "Acme", with: "Acme Renamed")
        let callCount = Counter()
        let store = makeStore(clock: clock, log: log) { _ in
            let count = callCount.increment()
            return StubResponse(status: 200, body: count == 1 ? Self.body : renamedBody)
        }
        _ = try await store.resolve(query(), forceRefresh: false)
        clock.current.addTimeInterval(ConfigStore.freshTTL + 1)

        let served = try await store.resolve(query(), forceRefresh: false)
        #expect(served.name == "Acme")

        try await Task.sleep(nanoseconds: 100_000_000)
        #expect(log.count == 2)
        #expect(try await store.resolve(query(), forceRefresh: false).name == "Acme Renamed")
    }

    @Test("an expired cache is still served rather than blanked")
    func expiredCacheStillServed() async throws {
        let clock = Clock()
        let log = RequestLog()
        let callCount = Counter()
        let store = makeStore(clock: clock, log: log) { _ in
            if callCount.increment() == 1 {
                return StubResponse(status: 200, body: Self.body)
            }
            throw URLError(.notConnectedToInternet)
        }
        _ = try await store.resolve(query(), forceRefresh: false)
        clock.current.addTimeInterval(7 * 24 * 60 * 60)

        #expect(try await store.resolve(query(), forceRefresh: false).name == "Acme")
    }

    @Test("forceRefresh bypasses a fresh cache")
    func forceRefreshBypassesFreshCache() async throws {
        let clock = Clock()
        let log = RequestLog()
        let callCount = Counter()
        let store = makeStore(clock: clock, log: log) { _ in
            let count = callCount.increment()
            let body = count == 1 ? Self.body : Self.body.replacingOccurrences(of: "Acme", with: "Acme Renamed")
            return StubResponse(status: 200, body: body)
        }
        _ = try await store.resolve(query(), forceRefresh: false)
        let refreshed = try await store.resolve(query(), forceRefresh: true)

        #expect(refreshed.name == "Acme Renamed")
        #expect(log.count == 2)
    }

    @Test("concurrent callers share one request")
    func concurrentCallersShareOneRequest() async throws {
        let clock = Clock()
        let log = RequestLog()
        let store = makeStore(clock: clock, log: log) { _ in StubResponse(status: 200, body: Self.body) }
        let q = try query()
        async let a = store.resolve(q, forceRefresh: false)
        async let b = store.resolve(q, forceRefresh: false)
        async let c = store.resolve(q, forceRefresh: false)
        let results = try await [a, b, c]

        #expect(log.count == 1)
        #expect(results.allSatisfy { $0.merchantId == Self.merchantId })
    }

    @Test("a 404 is a merchant resolution failure, not a decoding error")
    func notFoundIsResolutionFailure() async throws {
        let clock = Clock()
        let log = RequestLog()
        let store = makeStore(clock: clock, log: log) { _ in
            StubResponse(status: 404, body: "Merchant not found")
        }
        await #expect {
            _ = try await store.resolve(query(), forceRefresh: false)
        } throws: { error in
            guard case FrakError.merchantResolutionFailed = error else { return false }
            return true
        }
    }

    @Test("a 429 surfaces its Retry-After")
    func rateLimitSurfacesRetryAfter() async throws {
        let clock = Clock()
        let log = RequestLog()
        let store = makeStore(clock: clock, log: log) { _ in
            StubResponse(status: 429, body: "Too Many Requests", headers: ["Retry-After": "42"])
        }
        do {
            _ = try await store.resolve(query(), forceRefresh: false)
            Issue.record("expected a failure")
        } catch let FrakError.server(_, _, retryAfterSeconds) {
            #expect(retryAfterSeconds == 42)
        }
    }

    @Test("an implausible Retry-After is clamped")
    func implausibleRetryAfterIsClamped() async throws {
        let clock = Clock()
        let log = RequestLog()
        let store = makeStore(clock: clock, log: log) { _ in
            StubResponse(status: 429, body: "Too Many Requests", headers: ["Retry-After": "999999"])
        }
        do {
            _ = try await store.resolve(query(), forceRefresh: false)
            Issue.record("expected a failure")
        } catch let FrakError.server(_, _, retryAfterSeconds) {
            #expect(retryAfterSeconds == HTTPClient.maxRetryAfterSeconds)
        }
    }

    @Test("a 400 surfaces the backend error code")
    func badRequestSurfacesErrorCode() async throws {
        let clock = Clock()
        let log = RequestLog()
        let store = makeStore(clock: clock, log: log) { _ in
            StubResponse(
                status: 400,
                body: #"{"success":false,"error":"platform is required","code":"INVALID_PACKAGE_ID_PAIRING"}"#
            )
        }
        do {
            _ = try await store.resolve(query(), forceRefresh: false)
            Issue.record("expected a failure")
        } catch let FrakError.server(_, code, _) {
            #expect(code == "INVALID_PACKAGE_ID_PAIRING")
        }
    }

    @Test("a transport failure becomes a network error")
    func transportFailureBecomesNetworkError() async throws {
        let clock = Clock()
        let log = RequestLog()
        let store = makeStore(clock: clock, log: log) { _ in throw URLError(.notConnectedToInternet) }
        await #expect(throws: FrakError.self) {
            _ = try await store.resolve(query(), forceRefresh: false)
        }
    }

    @Test("backing off with nothing cached fails instead of dialling again")
    func backingOffWithEmptyCacheDoesNotDial() async throws {
        let clock = Clock()
        let log = RequestLog()
        let store = makeStore(clock: clock, log: log) { _ in throw URLError(.notConnectedToInternet) }
        _ = try? await store.resolve(query(), forceRefresh: false)
        let afterFirst = log.count

        // First-launch-offline: the backoff is armed and there is no cache to fall back on.
        // Serving that by dialling anyway makes a retry loop one real request per call.
        for _ in 0..<3 {
            await #expect(throws: FrakError.self) {
                _ = try await store.resolve(query(), forceRefresh: false)
            }
        }

        #expect(log.count == afterFirst)
    }

    @Test("the config survives a cold start through persistence")
    func configSurvivesColdStart() async throws {
        let clock = Clock()
        let log = RequestLog()
        let sharedStore = InMemoryKeyValueStore()
        let callCount = Counter()

        let (session, host) = StubURLProtocol.makeSession()
        StubURLProtocol.handle(host: host) { request in
            log.record(request)
            if callCount.increment() == 1 {
                return StubResponse(status: 200, body: Self.body)
            }
            throw URLError(.notConnectedToInternet)
        }
        let http = HTTPClient(baseURL: "https://\(host)", session: session)
        let firstStore = ConfigStore(
            http: http,
            store: sharedStore,
            logger: FrakLogger(level: .none),
            now: { clock.current }
        )
        _ = try await firstStore.resolve(query(), forceRefresh: false)

        // A new store shares only the KeyValueStore — the same situation as a fresh process.
        let coldStart = ConfigStore(
            http: http,
            store: sharedStore,
            logger: FrakLogger(level: .none),
            now: { clock.current }
        )
        let result = try await coldStart.resolve(query(), forceRefresh: false)

        #expect(result.name == "Acme")
    }

    @Test("a persisted entry for a different query is ignored")
    func persistedEntryForDifferentQueryIsIgnored() async throws {
        let clock = Clock()
        let sharedStore = InMemoryKeyValueStore()
        let callCount = Counter()

        let (session, host) = StubURLProtocol.makeSession()
        StubURLProtocol.handle(host: host) { _ in
            if callCount.increment() == 1 {
                return StubResponse(status: 200, body: Self.body)
            }
            throw URLError(.notConnectedToInternet)
        }
        let http = HTTPClient(baseURL: "https://\(host)", session: session)
        let firstStore = ConfigStore(
            http: http,
            store: sharedStore,
            logger: FrakLogger(level: .none),
            now: { clock.current }
        )
        _ = try await firstStore.resolve(query(), forceRefresh: false)

        let otherQuery = try MerchantQuery.from(FrakConfig(bundleId: "com.example.other"))
        let coldStart = ConfigStore(
            http: http,
            store: sharedStore,
            logger: FrakLogger(level: .none),
            now: { clock.current }
        )

        await #expect(throws: FrakError.self) {
            _ = try await coldStart.resolve(otherQuery, forceRefresh: false)
        }
    }

    @Test("the in-memory cache does not answer a different query")
    func inMemoryCacheDoesNotAnswerDifferentQuery() async throws {
        let clock = Clock()
        let log = RequestLog()
        let callCount = Counter()
        let store = makeStore(clock: clock, log: log) { _ in
            if callCount.increment() == 1 {
                return StubResponse(status: 200, body: Self.body)
            }
            return StubResponse(status: 200, body: Self.body.replacingOccurrences(of: "Acme", with: "Acme FR"))
        }
        _ = try await store.resolve(query(), forceRefresh: false)

        let frenchQuery = try MerchantQuery.from(
            FrakConfig(merchantId: Self.merchantId, metadata: FrakMetadata(lang: .fr))
        )
        let result = try await store.resolve(frenchQuery, forceRefresh: false)

        #expect(result.name == "Acme FR")
        #expect(log.count == 2)
    }

    @Test("an unreadable persisted entry is discarded rather than fatal")
    func unreadablePersistedEntryIsDiscarded() async throws {
        let clock = Clock()
        let log = RequestLog()
        let sharedStore = InMemoryKeyValueStore()
        sharedStore.set("{ this is not json", forKey: "resolved-config")

        let (session, host) = StubURLProtocol.makeSession()
        StubURLProtocol.handle(host: host) { request in
            log.record(request)
            return StubResponse(status: 200, body: Self.body)
        }
        let http = HTTPClient(baseURL: "https://\(host)", session: session)
        let store = ConfigStore(
            http: http,
            store: sharedStore,
            logger: FrakLogger(level: .none),
            now: { clock.current }
        )

        #expect(try await store.resolve(query(), forceRefresh: false).name == "Acme")
    }

    @Test("the sdk version header is sent on every request")
    func sdkVersionHeaderIsSent() async throws {
        let clock = Clock()
        let log = RequestLog()
        let store = makeStore(clock: clock, log: log) { _ in StubResponse(status: 200, body: Self.body) }
        _ = try await store.resolve(query(), forceRefresh: false)

        let request = try #require(log.all.first)
        #expect(request.value(forHTTPHeaderField: FrakSDKVersion.headerName) != nil)
    }

    @Test("query parameters are percent-encoded, and nils are dropped")
    func queryParametersAreEncodedAndNilsDropped() async throws {
        let clock = Clock()
        let log = RequestLog()
        let store = makeStore(clock: clock, log: log) { _ in StubResponse(status: 200, body: Self.body) }
        _ = try await store.resolve(query(), forceRefresh: false)

        let url = try #require(log.all.first?.url?.absoluteString)
        #expect(url.contains("merchantId=\(Self.merchantId)"))
        #expect(!url.contains("lang="))
    }
}
