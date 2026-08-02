import Foundation

actor DefaultFrakClient: FrakClient {
    private let config: FrakConfig
    private let configStore: ConfigStore
    private let rewards: RewardRepository

    private var latestConfig: FrakResolvedConfig?
    private var subscribers: [UUID: AsyncStream<FrakResolvedConfig>.Continuation] = [:]

    init(
        config: FrakConfig,
        store: KeyValueStore,
        logger: FrakLogger,
        session: URLSession = HTTPClient.defaultSession,
        backendURL: String? = nil
    ) {
        self.config = config
        let http = HTTPClient(baseURL: backendURL ?? config.env.backend, session: session)
        self.configStore = ConfigStore(http: http, store: store, logger: logger)
        self.rewards = RewardRepository(http: http, logger: logger)
    }

    var currentConfig: FrakResolvedConfig? {
        latestConfig
    }

    var configUpdates: AsyncStream<FrakResolvedConfig> {
        AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
            let id = UUID()
            if let latestConfig {
                continuation.yield(latestConfig)
            }
            subscribers[id] = continuation
            continuation.onTermination = { [weak self] _ in
                Task { await self?.removeSubscriber(id) }
            }
        }
    }

    func resolveConfig(forceRefresh: Bool) async throws -> FrakResolvedConfig {
        try await frakCall {
            try requireTrackingEnabled()
            let query = try MerchantQuery.from(config)
            let resolved = try await configStore.resolve(query, forceRefresh: forceRefresh)
            // Dedupe, mirroring the Kotlin twin's StateFlow: a cache-hit resolve that
            // returns the same config every subscriber already has must not re-emit.
            let changed = resolved != latestConfig
            latestConfig = resolved
            if changed {
                for continuation in subscribers.values {
                    continuation.yield(resolved)
                }
            }
            return resolved
        }
    }

    func campaigns(forceRefresh: Bool) async throws -> [Campaign] {
        try await frakCall {
            try await fetchRewards(targetInteraction: nil, audience: nil, forceRefresh: forceRefresh).campaigns
        }
    }

    func bestReward(
        targetInteraction: String?,
        audience: RewardAudience?,
        forceRefresh: Bool
    ) async throws -> BestReward? {
        try await frakCall {
            try await fetchRewards(
                targetInteraction: targetInteraction,
                audience: audience,
                forceRefresh: forceRefresh
            ).best
        }
    }

    /// Resolves the merchant, then reads its rewards. Sequencing resolve first means a
    /// bad merchant id surfaces as `merchantResolutionFailed` rather than a
    /// permanently empty reward list; it is nearly always a cache hit.
    private func fetchRewards(
        targetInteraction: String?,
        audience: RewardAudience?,
        forceRefresh: Bool
    ) async throws -> EstimatedRewardsResult {
        let resolved = try await resolveConfig(forceRefresh: false)
        return try await rewards.fetch(
            merchantId: resolved.merchantId,
            currency: config.metadata.currency,
            targetInteraction: targetInteraction,
            audience: audience,
            forceRefresh: forceRefresh
        )
    }

    private func removeSubscriber(_ id: UUID) {
        subscribers.removeValue(forKey: id)
    }

    // When tracking is off, no id is generated and no network is issued — including
    // for resolveConfig, which is itself a request on the user's behalf.
    private func requireTrackingEnabled() throws {
        guard config.trackingEnabled else { throw FrakError.trackingDisabled }
    }
}
