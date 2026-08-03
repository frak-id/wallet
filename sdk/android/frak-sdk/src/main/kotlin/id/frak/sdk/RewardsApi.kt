package id.frak.sdk

import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.core.ProductDetails
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.rewards.Campaign
import id.frak.sdk.rewards.RewardAudience

/** Campaigns and reward selection. Obtained from [FrakClient.rewards]. */
public class RewardsApi internal constructor(
    private val core: DefaultFrakClient,
) {
    /** Active campaigns for this merchant, highest priority first. */
    public suspend fun campaigns(forceRefresh: Boolean = false): List<Campaign> = core.campaigns(forceRefresh)

    /**
     * Reward worth advertising, formatted server-side; null when nothing matches.
     *
     * @param products the products currently in view (a product page, a cart, an order's
     *   line items), when known. Advisory: a campaign scoped to none of them is ranked below
     *   every campaign matching at least one. Omitting it preserves the unscoped ranking.
     */
    public suspend fun best(
        targetInteraction: String? = null,
        audience: RewardAudience? = null,
        forceRefresh: Boolean = false,
        products: List<ProductDetails>? = null,
    ): BestReward? = core.bestReward(targetInteraction, audience, forceRefresh, products)
}
