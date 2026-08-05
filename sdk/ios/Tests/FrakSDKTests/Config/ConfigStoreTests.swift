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

    @Test("a cache fetched in the future relative to now is treated as stale, not fresh forever")
    func futureDatedCacheIsTreatedAsStale() async throws {
        // A clock stepped backward, or a tampered fetchedAt, must not pin the entry as fresh
        // forever: negative elapsed time is still "less than freshTTL" if only the upper bound
        // is checked.
        let clock = Clock()
        clock.current = Date(timeIntervalSince1970: 10_000)
        let log = RequestLog()
        let renamedBody = Self.body.replacingOccurrences(of: "Acme", with: "Acme Renamed")
        let callCount = Counter()
        let store = makeStore(clock: clock, log: log) { _ in
            let count = callCount.increment()
            return StubResponse(status: 200, body: count == 1 ? Self.body : renamedBody)
        }
        _ = try await store.resolve(query(), forceRefresh: false)

        clock.current = Date(timeIntervalSince1970: 0)  // stepped backward: fetchedAt is now in the future
        _ = try await store.resolve(query(), forceRefresh: false)

        try await Task.sleep(nanoseconds: 100_000_000)
        #expect(log.count == 2, "a future-dated entry must revalidate, not read as fresh")
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

    @Test("background revalidation reaches the updates stream, not just memory (C3)")
    func backgroundRevalidationReachesUpdatesStream() async throws {
        let clock = Clock()
        let log = RequestLog()
        let renamedBody = Self.body.replacingOccurrences(of: "Acme", with: "Acme Renamed")
        let callCount = Counter()
        let store = makeStore(clock: clock, log: log) { _ in
            let count = callCount.increment()
            return StubResponse(status: 200, body: count == 1 ? Self.body : renamedBody)
        }

        var iterator = await store.updates.makeAsyncIterator()

        _ = try await store.resolve(query(), forceRefresh: false)
        let first = await iterator.next()
        #expect(first?.name == "Acme")

        clock.current.addTimeInterval(ConfigStore.freshTTL + 1)
        _ = try await store.resolve(query(), forceRefresh: false)  // stale: served from cache, revalidates behind it

        let second = await iterator.next()
        #expect(
            second?.name == "Acme Renamed",
            "a subscriber must see the revalidated value even though it never called resolve() again"
        )
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

    // C4's "an older fetch that starts first but lands last does not overwrite a newer publish"
    // case has no deterministic test here: it needs two requests genuinely in flight through one
    // ConfigStore/URLSession with the first response held back until the second publishes, and
    // URLSession does not guarantee concurrent custom-URLProtocol loads over one session — a
    // serialised second request would wedge the test on HTTPClient's Deadline instead of failing
    // it. This pins only what is provable without concurrent I/O: guard/publish ordering and
    // cross-key isolation.
    @Test("a fetch for one key does not publish over a different key's already-published result")
    func differentKeyFetchDoesNotOverwritePublishedResult() async throws {
        let clock = Clock()
        let log = RequestLog()
        let secondQuery = MerchantQuery.bundleId(bundleId: "com.example.second", lang: nil)

        let store = makeStore(clock: clock, log: log) { request in
            let isFirstQuery = request.url?.query?.contains("merchantId=\(Self.merchantId)") == true
            let body = isFirstQuery ? Self.body : Self.body.replacingOccurrences(of: "Acme", with: "Acme Second")
            return StubResponse(status: 200, body: body)
        }

        // Attached before either resolve: `updates` only replays `lastPublished`, so a later
        // iterator would miss "Acme" and then suspend forever waiting for a publish that never
        // comes.
        var iterator = await store.updates.makeAsyncIterator()

        // Sequential, not concurrent: the first key publishes, then the second, so the guard's
        // sequence check must not reject the second merely for belonging to a different key.
        let firstResult = try await store.resolve(query(), forceRefresh: true)
        // Hoisted out of #expect: iterator is a mutating value and #expect expands to a closure over it.
        let firstPublished = await iterator.next()
        #expect(firstPublished?.name == "Acme")
        let secondResult = try await store.resolve(secondQuery, forceRefresh: true)
        let secondPublished = await iterator.next()
        #expect(secondPublished?.name == "Acme Second")

        #expect(firstResult.name == "Acme")
        #expect(secondResult.name == "Acme Second")

        // currentConfig reads memory directly; it must agree with the stream since memory
        // already holds the second key's entry.
        #expect(await store.currentConfig(secondQuery)?.name == "Acme Second")
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

    /// Pins that `currentConfig` is populated by the hydrate-and-serve-from-cache path even
    /// though `updates` stays empty, since `fetch` is the only publish point and a fresh-cache
    /// resolve never reaches it.
    @Test("currentConfig hydrates from disk on its own, without a prior resolve call")
    func currentConfigHydratesWithoutResolve() async throws {
        let clock = Clock()
        let log = RequestLog()
        let sharedStore = InMemoryKeyValueStore()
        let callCount = Counter()

        let (session, host) = StubURLProtocol.makeSession()
        StubURLProtocol.handle(host: host) { request in
            log.record(request)
            callCount.increment()
            return StubResponse(status: 200, body: Self.body)
        }
        let http = HTTPClient(baseURL: "https://\(host)", session: session)
        let firstStore = ConfigStore(
            http: http,
            store: sharedStore,
            logger: FrakLogger(level: .none),
            now: { clock.current }
        )
        _ = try await firstStore.resolve(query(), forceRefresh: false)
        let requestsAfterFirstFetch = callCount.value

        // A second, independent store sharing only the persisted KeyValueStore, as if reading
        // disk after a fresh process start. Never calls warmStore.resolve().
        let warmStore = ConfigStore(
            http: http,
            store: sharedStore,
            logger: FrakLogger(level: .none),
            now: { clock.current }
        )

        // Hoisted: query() throws, and #expect expands to a rethrowing call that cannot host
        // try on an autoclosure argument.
        let warmQuery = try query()
        #expect(await warmStore.currentConfig(warmQuery)?.name == "Acme")
        #expect(callCount.value == requestsAfterFirstFetch, "currentConfig must not reach the network")

        // Attaching after hydration should see no replay, since only fetch() publishes — a
        // wrongly-published value here would show up as an early arrival instead of a timeout.
        // The stream is hoisted out of the closure but the iterator is created inside the child
        // task: a non-Sendable AsyncIterator captured by a @Sendable addTask closure does not
        // compile under -swift-version 6.
        let received = Counter()
        let stream = await warmStore.updates
        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                var iterator = stream.makeAsyncIterator()
                // `if let`, not a bare `_ = await`: a cancelled AsyncStream iterator resolves
                // with nil rather than hanging, and incrementing unconditionally would count
                // that as a publish.
                if await iterator.next() != nil {
                    received.increment()
                }
            }
            group.addTask {
                try? await Task.sleep(nanoseconds: 200_000_000)
            }
            await group.next()
            group.cancelAll()
        }
        #expect(
            received.value == 0,
            "currentConfig's disk hydration must not publish to the stream — only fetch() does (C3)"
        )
    }

    @Test("currentConfig returns nil for a key nothing was ever persisted under")
    func currentConfigReturnsNilForUnpersistedKey() async throws {
        let clock = Clock()
        let log = RequestLog()
        let sharedStore = InMemoryKeyValueStore()

        let (session, host) = StubURLProtocol.makeSession()
        StubURLProtocol.handle(host: host) { request in
            log.record(request)
            return StubResponse(status: 200, body: Self.body)
        }
        let http = HTTPClient(baseURL: "https://\(host)", session: session)
        let firstStore = ConfigStore(
            http: http,
            store: sharedStore,
            logger: FrakLogger(level: .none),
            now: { clock.current }
        )
        _ = try await firstStore.resolve(query(), forceRefresh: false)

        let warmStore = ConfigStore(
            http: http,
            store: sharedStore,
            logger: FrakLogger(level: .none),
            now: { clock.current }
        )
        let otherQuery = MerchantQuery.bundleId(bundleId: "com.example.other", lang: nil)

        #expect(await warmStore.currentConfig(otherQuery) == nil)
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
