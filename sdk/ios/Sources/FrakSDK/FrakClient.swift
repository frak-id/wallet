/// Everything the SDK can do, as one facade.
///
/// Obtained from `Frak.client`. A protocol rather than the implementation type so
/// merchant tests can substitute a fake without a mocking framework.
public protocol FrakClient: Sendable {
    /// The last successfully resolved config, or nil before the first resolve.
    var currentConfig: FrakResolvedConfig? { get async }

    /// A multicast stream of every resolved config, replaying the latest value to a
    /// new subscriber.
    var configUpdates: AsyncStream<FrakResolvedConfig> { get async }

    /// Resolves the merchant this app belongs to, from a stale-while-revalidate cache.
    /// Failure backoff still applies even under `forceRefresh`. Throws
    /// `FrakError.merchantResolutionFailed` when no merchant matches this app.
    func resolveConfig(forceRefresh: Bool) async throws -> FrakResolvedConfig

    /// Active campaigns for this merchant, highest priority first. An empty list is a
    /// normal "between campaigns" state — use `resolveConfig` to diagnose an unknown
    /// merchant.
    func campaigns(forceRefresh: Bool) async throws -> [Campaign]

    /// The single reward worth advertising, formatted by the server. Currency comes
    /// from `FrakMetadata`, never the caller and never the device locale.
    func bestReward(
        targetInteraction: String?,
        audience: RewardAudience?,
        forceRefresh: Bool
    ) async throws -> BestReward?
}

extension FrakClient {
    // Protocol requirements can't carry default arguments, so the cache-first calls
    // live here. Each signature differs from its requirement on purpose: an overload
    // that matched would satisfy the protocol itself, and a conformer that forgot the
    // method would recurse forever instead of failing to compile.

    public func resolveConfig() async throws -> FrakResolvedConfig {
        try await resolveConfig(forceRefresh: false)
    }

    public func campaigns() async throws -> [Campaign] {
        try await campaigns(forceRefresh: false)
    }

    public func bestReward(
        targetInteraction: String? = nil,
        audience: RewardAudience? = nil
    ) async throws -> BestReward? {
        try await bestReward(targetInteraction: targetInteraction, audience: audience, forceRefresh: false)
    }
}
