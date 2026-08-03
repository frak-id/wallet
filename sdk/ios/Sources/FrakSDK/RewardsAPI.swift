import Foundation

/// Campaigns and reward selection. Obtained from `FrakClient.rewards`.
public struct RewardsAPI: Sendable {
    let core: DefaultFrakClient

    /// Active campaigns for this merchant, highest priority first.
    public func campaigns(forceRefresh: Bool = false) async throws -> [Campaign] {
        try await core.campaigns(forceRefresh: forceRefresh)
    }

    // products is advisory context (a product page, a cart, an order's line items). A
    // campaign scoped to none of them is deprioritized server-side; omitting it preserves
    // the unscoped ranking.
    /// Reward worth advertising, formatted server-side; nil when nothing matches.
    public func best(
        targetInteraction: String? = nil,
        audience: RewardAudience? = nil,
        forceRefresh: Bool = false,
        products: [ProductDetails]? = nil
    ) async throws -> BestReward? {
        try await core.bestReward(
            targetInteraction: targetInteraction,
            audience: audience,
            forceRefresh: forceRefresh,
            products: products
        )
    }
}
