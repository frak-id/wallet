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
        // A clock stepped backward after the fetch, or a corrupted/tampered persisted fetchedAt,
        // must not pin the entry as fresh forever (N7): now().timeIntervalSince(fetchedAt)
        // negative is still "less than freshTTL" if only the upper bound is checked.
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

    /// C3: `updates` is this actor's own stream, not something forwarded from a caller-side
    /// `resolveConfig()` write — so it must reach a subscriber from BACKGROUND revalidation too,
    /// the path that never touched it before this finding. Before the fix, only a direct
    /// `ConfigStore.resolve` caller ever saw an update; a subscriber sitting on `updates` alone
    /// (the real-world shape: a UI observing config without itself calling `resolve` on every
    /// stale hit) never learned the revalidated value existed.
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
    // case does not have a deterministic test on this platform. It needs two requests genuinely
    // in flight at once through ONE ConfigStore/HTTPClient/URLSession, with the first response
    // deliberately held back until the second has published — which means blocking inside
    // StubURLProtocol.startLoading() for one request while the other is still in flight on the
    // SAME session. Nothing in Foundation's public contract guarantees URLSession runs two
    // custom-URLProtocol loads concurrently rather than serialising them onto one queue; if it
    // does serialise them, the second request never starts, the first's blocking wait is never
    // released, and the test only unwinds via HTTPClient's 20s Deadline — a wedged thread, not a
    // failure. That could not be verified without a toolchain to run it against, so rather than
    // land a test that might hang CI, this pins only what IS provable without concurrent network
    // I/O: the guard's comparison and publish logic (see the unit-level sequencing below), plus
    // cross-key isolation-not-corruption. The Kotlin twin's equivalent test (`ConfigStoreTest.kt`,
    // same finding id) uses a real second `Dispatchers.IO` thread instead of the cooperative pool
    // and is not exposed to this same ambiguity, since JVM thread scheduling doesn't route through
    // a single URLSession's task queue.
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

        // Attached BEFORE either resolve: `updates` only replays `lastPublished`, so an
        // iterator created afterward would miss "Acme" and then suspend forever waiting for a
        // third publish that never comes.
        var iterator = await store.updates.makeAsyncIterator()

        // Sequential, not concurrent: the first key publishes, then the second key publishes,
        // proving the guard does not reject a later, genuinely-newer sequence number just because
        // it belongs to a different cache key than the one already published.
        let firstResult = try await store.resolve(query(), forceRefresh: true)
        // Hoisted out of #expect: the suite's convention everywhere else, because an iterator is
        // a mutating value and #expect's expansion is a closure over it.
        let firstPublished = await iterator.next()
        #expect(firstPublished?.name == "Acme")
        let secondResult = try await store.resolve(secondQuery, forceRefresh: true)
        let secondPublished = await iterator.next()
        #expect(secondPublished?.name == "Acme Second")

        #expect(firstResult.name == "Acme")
        #expect(secondResult.name == "Acme Second")

        // The iterator MUST attach before either resolve: `updates` replays only `lastPublished`,
        // a single value, so an iterator created after both calls would see the replay on its
        // first `next()` (skipping "Acme" entirely) and then suspend forever on its second —
        // nothing publishes again and nothing ever calls `continuation.finish()`. Swift Testing
        // has no default per-test timeout, so that ordering wedges the run permanently rather
        // than failing it.
        //
        // memory must agree with the stream it feeds: `currentConfig(secondQuery)` reads memory
        // directly here, since memory already holds the second key's entry.
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

    /// 3.2 regression: `DefaultFrakClient.handleReferralLink`'s merchant guard resolves
    /// `ownMerchantId` from `ConfigStore.currentConfig`, precisely so a warm start whose cached
    /// entry is still fresh — the ordinary case, never touching `fetch` at all in this process —
    /// still has a merchant id available. `updates` alone cannot supply it: `fetch` is C3's one
    /// publish point, and a fresh-cache resolve never reaches it. This pins that `currentConfig`
    /// IS populated by that hydrate-and-serve-from-cache path, while `updates` stays empty because
    /// nothing published — the same guarantee the Kotlin twin's `ConfigStore.currentConfig()`
    /// exists to provide, since both platforms must resolve "last known config" from the same kind
    /// of source (`DefaultFrakClient.kt`'s 3.2 comment, `DefaultFrakClient.swift:179`).
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

        // A second, independent store instance sharing only the persisted KeyValueStore — the
        // same situation as a fresh process reading what a previous run wrote to disk. Nothing
        // in this test ever calls warmStore.resolve().
        let warmStore = ConfigStore(
            http: http,
            store: sharedStore,
            logger: FrakLogger(level: .none),
            now: { clock.current }
        )

        // Hoisted: `query()` throws, and `#expect` expands to a rethrowing call, so it cannot
        // host a `try` on an autoclosure argument.
        let warmQuery = try query()
        #expect(await warmStore.currentConfig(warmQuery)?.name == "Acme")
        #expect(callCount.value == requestsAfterFirstFetch, "currentConfig must not reach the network")

        // A subscriber attaching AFTER the hydration must see no replay: `updates` only ever
        // replays `lastPublished`, and nothing has published on this store instance — only
        // fetch() publishes (C3). If currentConfig's disk hydration wrongly published, this would
        // instead see "Acme" arrive immediately instead of timing out. `received` (the existing
        // lock-protected `Counter` from `TestSupport.swift`) is incremented only when a value
        // genuinely ARRIVES, so a timeout win leaves it at zero; racing avoids ever awaiting an
        // iterator that could otherwise suspend forever. The (Sendable) stream is hoisted out of
        // the closure and iterated INSIDE the child task: a non-Sendable AsyncIterator captured
        // and mutated by a @Sendable addTask closure does not compile under -swift-version 6.
        let received = Counter()
        let stream = await warmStore.updates
        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                var iterator = stream.makeAsyncIterator()
                // `if let`, not a bare `_ = await`: once the timeout branch wins and cancels the
                // group, a cancelled AsyncStream iterator RESOLVES WITH nil rather than hanging.
                // Incrementing unconditionally therefore counted that cancellation as a publish,
                // and this assertion could never fail for the reason it claims to test.
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
