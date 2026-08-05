package id.frak.sdk

import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.ProductDetails
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.rewards.Campaign
import id.frak.sdk.rewards.RewardAudience

/** Campaigns and reward selection. Obtained from [FrakClient.rewards]. */
public class RewardsApi internal constructor(
    private val core: DefaultFrakClient,
) {
    /** Active campaigns for this merchant, highest priority first. */
    @Throws(FrakError::class)
    public suspend fun campaigns(forceRefresh: Boolean = false): List<Campaign> = core.campaigns(forceRefresh)

    /**
     * Reward worth advertising, formatted server-side; null when nothing matches.
     *
     * Call once per screen for the whole visible product set, not once per row: the cache is
     * keyed on the encoded product list, so per-row calls multiply cache keys and requests.
     *
     * @param products products currently in view, when known. Advisory: a campaign scoped to
     *   none of them is ranked below one matching at least one.
     */
    @Throws(FrakError::class)
    public suspend fun best(
        targetInteraction: String? = null,
        audience: RewardAudience? = null,
        forceRefresh: Boolean = false,
        products: List<ProductDetails>? = null,
    ): BestReward? = core.bestReward(targetInteraction, audience, forceRefresh, products)
}
