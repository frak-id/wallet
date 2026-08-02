import Foundation

/// Stale-while-revalidate cache over `GET /user/merchant/resolve`.
///
/// Fresh (< 5 min) is served from memory with no network call; stale is served
/// immediately and revalidated in the background. No hard expiry — any cached copy
/// beats an error.
actor ConfigStore {
    /// Served without a network call.
    static let freshTTL: TimeInterval = 5 * 60

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
            if now().timeIntervalSince(cached.fetchedAt) < Self.freshTTL {
                return cached.config
            }
            // Stale: hand back what we have and refresh behind the caller's back.
            revalidateInBackground(key, query: query)
            return cached.config
        }

        // Backing off, so dialling again would only reproduce the same failure. Any
        // cached copy beats that, including under forceRefresh. With none, fail rather
        // than let a retry loop become a flood.
        if backoff.isBackingOff(key) {
            if let fallback = readCache(key) { return fallback.config }
            throw FrakError.network(underlying: Backoff.BackingOff(what: "merchant config fetch"))
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
        memory = entry
        writePersisted(entry)
        return config
    }

    /// Maps a non-2xx onto a `FrakError`. Dispatch is on status, never `Content-Type`:
    /// this route answers 404 as `text/plain`, not the JSON error envelope.
    private func mapFailure(_ response: HTTPClient.Response) -> FrakError {
        if response.status == Self.httpNotFound {
            return .merchantResolutionFailed(
                reason: "the backend has no merchant registered for this app. "
                    + "Check FrakConfig.merchantId, or that this bundle id is in the merchant's allowed package ids."
            )
        }
        let code = JSONDecoding.errorCode(in: response.body)
        if code == Self.invalidPackageIdPairing {
            // Unreachable via MerchantQuery, which pairs bundleId and platform
            // unconditionally. Named anyway: if it ever fires, the query builder has a bug.
            logger.error("Frak sent a bundleId with no platform. This is an SDK bug — please report it.")
        }
        if response.status == Self.httpUnprocessable {
            let text = String(decoding: response.body, as: UTF8.self)
            logger.error("Frak sent a request the backend rejected as malformed: \(text.prefix(200))")
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
