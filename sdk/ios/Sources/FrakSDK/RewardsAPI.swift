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
    /// The best reward worth advertising IN THIS CONTEXT, formatted server-side; nil when
    /// nothing matches. "This context" means whatever `products`/`targetInteraction` describe
    /// — a single product page, a cart, one order's line items — not "the best reward
    /// anywhere in the app". A single call answers for the whole set passed in; it does not
    /// tell you which individual item earned it, because a lone `BestReward?` cannot be
    /// mapped back onto per-item rows.
    ///
    /// For a listing/catalog screen, call this ONCE for the full visible set of products.
    /// Calling it again per row is an anti-pattern: it multiplies network requests and each
    /// call still can't be attributed back to one row, so nothing is gained over the single
    /// call.
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
