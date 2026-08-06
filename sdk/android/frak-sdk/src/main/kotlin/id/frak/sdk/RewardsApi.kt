package id.frak.sdk

import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.core.FrakError
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.rewards.Campaign
import id.frak.sdk.rewards.RewardRequest
import java.util.concurrent.CompletableFuture

/** Campaigns and reward selection. Obtained from [FrakClient.rewards]. */
public class RewardsApi internal constructor(
    private val core: DefaultFrakClient,
) {
    /** Active campaigns for this merchant, highest priority first. */
    @Throws(FrakError::class)
    public suspend fun campaigns(): List<Campaign> = core.campaigns(forceRefresh = false)

    /** @param forceRefresh skips the cache and the backoff. */
    @Throws(FrakError::class)
    public suspend fun campaigns(forceRefresh: Boolean): List<Campaign> = core.campaigns(forceRefresh)

    /** [campaigns] for Java. */
    public fun campaignsAsync(): CompletableFuture<List<Campaign>> = campaignsAsync(false)

    /** [campaigns] for Java. */
    public fun campaignsAsync(forceRefresh: Boolean): CompletableFuture<List<Campaign>> =
        core.asFuture { campaigns(forceRefresh) }

    /**
     * Reward worth advertising, formatted server-side; null when nothing matches.
     *
     * Call once per screen for the whole visible product set, not once per row: the cache is keyed
     * on the encoded product list, so per-row calls multiply cache keys and requests.
     */
    @Throws(FrakError::class)
    public suspend fun best(request: RewardRequest): BestReward? = best(request, forceRefresh = false)

    /** @param forceRefresh skips the cache and the backoff. */
    @Throws(FrakError::class)
    public suspend fun best(
        request: RewardRequest,
        forceRefresh: Boolean,
    ): BestReward? =
        core.bestReward(
            request.targetInteraction,
            request.audience,
            forceRefresh,
            // the core encodes empty and absent identically; RewardRequest holds the non-null shape.
            request.products.takeIf { it.isNotEmpty() },
        )

    /** [best] for Java. */
    public fun bestAsync(request: RewardRequest): CompletableFuture<BestReward?> = bestAsync(request, false)

    /** [best] for Java. */
    public fun bestAsync(
        request: RewardRequest,
        forceRefresh: Boolean,
    ): CompletableFuture<BestReward?> = core.asFuture { best(request, forceRefresh) }
}
