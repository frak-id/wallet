import Foundation

/// Stale-while-revalidate cache over `GET /user/merchant/resolve`.
///
/// Fresh (< 5 min) is served from memory with no network call; stale is served
/// immediately and revalidated in the background. No hard expiry — any cached copy
/// beats an error.
///
/// This actor, not `DefaultFrakClient`, owns `updates`: `fetch` is the one choke point every
/// resolved config passes through, foreground or background alike, so publishing here is what
/// makes revalidation visible to a subscriber. The publish is gated by a sequence number so an
/// out-of-order landing — two different queries' fetches genuinely running concurrently, since
/// `SingleFlight` only serialises same-key fetches — can never overwrite a newer result with an
/// older one.
actor ConfigStore {
    /// Served without a network call.
    static let freshTTL: TimeInterval = 5 * 60

    /// A `fetchedAt` in the future — the clock stepped backward since the fetch, or a
    /// corrupted/tampered persisted value — must never read as fresh:
    /// `now().timeIntervalSince(fetchedAt)` would be negative, which is always less than
    /// `freshTTL`, pinning the entry as fresh forever.
    private static func isFresh(_ fetchedAt: Date, now: Date) -> Bool {
        let elapsed = now.timeIntervalSince(fetchedAt)
        return elapsed >= 0 && elapsed < freshTTL
    }

    static let resolvePath = "/user/merchant/resolve"

    private static let storageKey = "resolved-config"
    private static let invalidPackageIdPairing = "INVALID_PACKAGE_ID_PAIRING"
    private static let httpNotFound = 404
    private static let httpUnprocessable = 422
    private static let encoder = JSONEncoder()

    private struct Entry {
        let key: String
        let config: FrakResolvedConfig
        let body: Data
        let fetchedAt: Date
    }

    private struct PersistedEnvelope: Codable {
        let key: String
        let sdkVersion: String
        let fetchedAt: Date
        let body: String
    }

    private let http: HTTPClient
    private let store: KeyValueStore
    private let logger: FrakLogger
    private let now: @Sendable () -> Date

    private var memory: Entry?
    private var singleFlight = SingleFlight<FrakResolvedConfig>()
    private var backoff = Backoff()
    /// Keys with a background revalidation already in flight.
    private var revalidating: Set<String> = []

    private var subscribers: [UUID: AsyncStream<FrakResolvedConfig>.Continuation] = [:]

    /// The last config actually published to `updates` — a separate slot from `memory`, which
    /// `readCache` also writes on a disk hydration that does not publish. Dedup and replay must
    /// compare against what a subscriber has already seen, not whatever happens to be cached:
    /// if this used `memory` directly, a warm start would hydrate `memory` from disk first,
    /// then `fetch`'s revalidation would find an equal config, see no difference against the
    /// already-updated `memory`, and never publish — leaving a subscriber attached before the
    /// hydration waiting forever.
    private var lastPublished: FrakResolvedConfig?

    /// Replay-latest, deduped on equal: replaces `DefaultFrakClient`'s own subscriber set, which
    /// only a direct `resolveConfig()` caller ever fed — background revalidation updated
    /// `memory` but never this. Equality is `FrakResolvedConfig`'s own conformance over every
    /// field, so "equal" here genuinely means "no observable change."
    var updates: AsyncStream<FrakResolvedConfig> {
        AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            let id = UUID()
            if let lastPublished {
                continuation.yield(lastPublished)
            }
            subscribers[id] = continuation
            continuation.onTermination = { [weak self] _ in
                Task { await self?.removeSubscriber(id) }
            }
        }
    }

    /// Best-known config right now, without waiting on `updates` to have published anything,
    /// and without a network call. Needed because the dominant deep-link flow launches the
    /// process from the referral URL, so a merchant-arrival check can run before anything has
    /// called `resolve` — `memory` is still empty, and `updates` alone cannot answer either,
    /// since a cache hit publishes nothing. `readCache` hydrates `memory` from disk on first
    /// miss without issuing a request, mirroring the Kotlin twin's `currentConfig`, which reads
    /// the same slot populated the same way.
    func currentConfig(_ query: MerchantQuery) -> FrakResolvedConfig? {
        readCache(query.cacheKey)?.config
    }

    private func removeSubscriber(_ id: UUID) {
        subscribers.removeValue(forKey: id)
    }

    /// Ends every `updates` stream. Called from `DefaultFrakClient.shutdown`, which otherwise
    /// leaves a merchant's `for await` suspended forever against a client that is gone.
    func finishSubscribers() {
        for continuation in subscribers.values {
            continuation.finish()
        }
        subscribers.removeAll()
    }

    /// Minted at the start of `fetch`, before the network call, and compared again at publish
    /// time. Minting at start records the order fetches were intended in, which is what
    /// matters — a counter read at publish time would order by completion, exactly what a
    /// slow-fetch-lands-last race gets wrong. No explicit lock needed: actor isolation is the
    /// lock.
    private var sequenceCounter: Int64 = 0
    private var publishedSequence: Int64 = Int64.min

    init(
        http: HTTPClient,
        store: KeyValueStore,
        logger: FrakLogger,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.http = http
        self.store = store
        self.logger = logger
        self.now = now
    }

    /// Returns the merchant config, from cache when it is usable.
    func resolve(_ query: MerchantQuery, forceRefresh: Bool) async throws -> FrakResolvedConfig {
        let key = query.cacheKey

        let cached = forceRefresh ? nil : readCache(key)
        if let cached {
            if Self.isFresh(cached.fetchedAt, now: now()) {
                return cached.config
            }
            // Stale: hand back what we have and refresh behind the caller's back.
            revalidateInBackground(key, query: query)
            return cached.config
        }

        // Backing off, so dialling again would only reproduce the same failure. Any
        // cached copy beats that, including under forceRefresh. With none, fail rather
        // than let a retry loop become a flood.
        if let retryAfter = backoff.remaining(key) {
            if let fallback = readCache(key) { return fallback.config }
            throw FrakError.backingOff(retryAfterSeconds: retryAfter)
        }

        return try await singleFlight.run(key) { try await self.fetch(key, query: query) }
    }

    /// Reads the entry for `key`, hydrating from disk on first miss.
    private func readCache(_ key: String) -> Entry? {
        if let memory, memory.key == key { return memory }
        guard let hydrated = readPersisted(key) else { return nil }
        memory = hydrated
        return hydrated
    }

    private func fetch(_ key: String, query: MerchantQuery) async throws -> FrakResolvedConfig {
        // Minted before the network call, and before this actor is relinquished at the await
        // below (actors are reentrant, so another fetch can genuinely interleave here), so it
        // records intent order, not completion order.
        sequenceCounter += 1
        let sequence = sequenceCounter

        let response: HTTPClient.Response
        do {
            response = try await http.get(Self.resolvePath, query: query.parameters)
        } catch let error as FrakError {
            backoff.recordFailure(key, from: error)
            throw error
        }

        if !response.isSuccess {
            try backoff.recordFailureAndThrow(key, mapFailure(response))
        }

        let config = try ResolvedConfigDecoder.decode(response.body)
        backoff.recordSuccess(key)
        let entry = Entry(key: key, config: config, body: response.body, fetchedAt: now())
        // An older fetch that started first but lands last must not overwrite a newer result
        // already published, on the stream or on disk. The caller below still gets its own
        // config regardless — only the shared publish is guarded.
        if sequence > publishedSequence {
            publishedSequence = sequence
            // Dedup against the previous publish (`lastPublished`), not against `memory`:
            // `memory` is also written by `readCache`'s disk hydration, which never publishes,
            // so comparing against `memory` here would silently drop the first revalidation on
            // a warm start whenever the hydrated and revalidated configs are equal.
            let changed = config != lastPublished
            memory = entry
            writePersisted(entry)
            if changed {
                lastPublished = config
                for continuation in subscribers.values {
                    continuation.yield(config)
                }
            }
        }
        return config
    }

    /// Maps a non-2xx onto a `FrakError`. Dispatch is on status, never `Content-Type`:
    /// this route answers 404 as `text/plain`, not the JSON error envelope.
    private func mapFailure(_ response: HTTPClient.Response) -> FrakError {
        if response.status == Self.httpNotFound {
            return .merchantResolutionFailed(
                reason: "the backend has no merchant registered for this app. "
                    + "Check FrakConfig.merchantId, or that this bundle id is in the merchant's "
                    + "allowed package ids."
            )
        }
        let code = JSONDecoding.errorCode(in: response.body)
        if code == Self.invalidPackageIdPairing {
            // Unreachable via MerchantQuery, which pairs bundleId and platform
            // unconditionally. Named anyway: if it ever fires, the query builder has a bug.
            logger.error("Frak sent a bundleId with no platform. This is an SDK bug — please report it.")
        }
        if response.status == Self.httpUnprocessable {
            // Never log response.body here: it is backend-controlled and may echo request content.
            let bodyBytes = response.body.count
            logger.error("Frak sent a request the backend rejected as malformed (status 422, body \(bodyBytes) bytes)")
        }
        return response.toServerError()
    }

    private func revalidateInBackground(_ key: String, query: MerchantQuery) {
        guard !revalidating.contains(key), !backoff.isBackingOff(key) else { return }
        revalidating.insert(key)

        Task {
            defer { revalidating.remove(key) }
            do {
                _ = try await singleFlight.run(key) { try await self.fetch(key, query: query) }
            } catch let error as FrakError {
                // Swallowed by design: nobody is waiting on this, and the caller already
                // has an answer.
                logger.debug("Frak background config revalidation failed: \(error.localizedDescription)")
            }
        }
    }

    /// Reads the persisted copy, if it is for this key and this SDK build. The raw
    /// response body is persisted rather than a re-decoded model, so cold-start and
    /// live decoding always share one path.
    private func readPersisted(_ key: String) -> Entry? {
        guard let raw = store.string(forKey: Self.storageKey) else { return nil }
        do {
            let envelope = try JSONDecoding.decode(PersistedEnvelope.self, from: Data(raw.utf8))
            guard envelope.key == key, envelope.sdkVersion == FrakSDKVersion.current else { return nil }
            let body = Data(envelope.body.utf8)
            let config = try ResolvedConfigDecoder.decode(body)
            return Entry(key: key, config: config, body: body, fetchedAt: envelope.fetchedAt)
        } catch {
            // Corrupt or unreadable cache is recoverable by fetching. Never fatal.
            logger.debug("Frak discarded an unreadable persisted config: \(error.localizedDescription)")
            store.removeValue(forKey: Self.storageKey)
            return nil
        }
    }

    /// One slot, holding the most recently fetched entry whatever its key.
    private func writePersisted(_ entry: Entry) {
        let envelope = PersistedEnvelope(
            key: entry.key,
            sdkVersion: FrakSDKVersion.current,
            fetchedAt: entry.fetchedAt,
            body: String(decoding: entry.body, as: UTF8.self)
        )
        guard let data = try? Self.encoder.encode(envelope), let json = String(data: data, encoding: .utf8) else {
            return
        }
        store.set(json, forKey: Self.storageKey)
    }
}
