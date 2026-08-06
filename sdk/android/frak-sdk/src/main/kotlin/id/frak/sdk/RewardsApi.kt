package id.frak.sdk

import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.core.FrakError
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.rewards.Campaign
import id.frak.sdk.rewards.RewardRequest
import java.util.concurrent.CompletableFuture

/**
 * Campaigns and reward selection. Obtained from [FrakClient.rewards].
 *
 * `*Async` twins, and why: see [ConfigApi].
 */
public class RewardsApi internal constructor(
    private val core: DefaultFrakClient,
) {
    /** Active campaigns for this merchant, highest priority first. */
    @Throws(FrakError::class)
    public suspend fun campaigns(): List<Campaign> = core.campaigns(forceRefresh = false)

    /**
     * @param forceRefresh skips the cache and the backoff. Explicit overload, not a default — see
     *   [ConfigApi.resolve].
     */
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
     * Call once per screen for the whole visible product set, not once per row: the cache is
     * keyed on the encoded product list, so per-row calls multiply cache keys and requests.
     *
     * Takes a [RewardRequest] rather than four optional parameters, because four optionals is what a
     * parameter object is for and because a Kotlin default freezes an arity in the ABI. `forceRefresh`
     * stays outside it deliberately — see [RewardRequest]'s own KDoc.
     */
    @Throws(FrakError::class)
    public suspend fun best(request: RewardRequest): BestReward? = best(request, forceRefresh = false)

    /** @param forceRefresh skips the cache and the backoff. Explicit overload, not a default. */
    @Throws(FrakError::class)
    public suspend fun best(
        request: RewardRequest,
        forceRefresh: Boolean,
    ): BestReward? =
        core.bestReward(
            request.targetInteraction,
            request.audience,
            forceRefresh,
            // The core takes a nullable list and encodes empty and absent identically; `RewardRequest`
            // holds the non-null shape, so this is where the two spellings meet.
            request.products.takeIf { it.isNotEmpty() },
        )

    /** [best] for Java. */
    public fun bestAsync(request: RewardRequest): CompletableFuture<BestReward?> = bestAsync(request, false)

    /**
     * [best] for Java.
     *
     * Delegates to the suspending member rather than repeating the `RewardRequest` → core mapping.
     * `RewardRequest` is built to grow, and a second mapping site is a field silently dropped from the
     * Java surface the day it does.
     */
    public fun bestAsync(
        request: RewardRequest,
        forceRefresh: Boolean,
    ): CompletableFuture<BestReward?> = core.asFuture { best(request, forceRefresh) }
}
