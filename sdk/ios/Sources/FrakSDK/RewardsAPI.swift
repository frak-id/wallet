import Foundation

/// Campaigns and reward selection. Obtained from `FrakClient.rewards`.
public struct RewardsAPI: Sendable {
    let core: DefaultFrakClient

    /// Active campaigns for this merchant, highest priority first.
    public func campaigns(forceRefresh: Bool = false) async throws -> [Campaign] {
        try await core.campaigns(forceRefresh: forceRefresh)
    }

    /// The best reward worth advertising for `request`, formatted server-side. One call answers
    /// for the whole set it describes and cannot say which item earned it, so a listing screen
    /// calls this once for every visible product rather than once per row.
    ///
    /// - Parameters:
    ///   - request: what to look the reward up for; `products` is advisory ranking context.
    ///   - forceRefresh: skips the cache and the backoff.
    /// - Returns: nil when nothing matches.
    /// - Throws: `FrakError` when the lookup itself fails.
    public func best(
        _ request: RewardRequest = RewardRequest(),
        forceRefresh: Bool = false
    ) async throws -> BestReward? {
        try await core.bestReward(
            targetInteraction: request.targetInteraction,
            audience: request.audience,
            forceRefresh: forceRefresh,
            products: request.wireProducts
        )
    }
}
