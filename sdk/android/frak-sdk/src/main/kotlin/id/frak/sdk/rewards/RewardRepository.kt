package id.frak.sdk.rewards

import id.frak.sdk.config.Backoff
import id.frak.sdk.config.SingleFlight
import id.frak.sdk.core.FrakCurrency
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.net.HttpClient
import id.frak.sdk.net.HttpClient.Companion.toServerError
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Reads `GET /user/merchant/estimated-rewards`, with a 30s cache and no
 * stale-while-revalidate: unlike config, an expired entry is dropped rather
 * than served, because a stale reward figure is money shown to a user. A
 * miss renders the merchant's no-reward copy, which is a correct outcome.
 */
internal class RewardRepository(
    private val http: HttpClient,
    private val logger: FrakLogger,
    scope: CoroutineScope,
    private val now: () -> Long = System::currentTimeMillis,
) {
    private val singleFlight = SingleFlight(scope)
    private val backoff = Backoff(now)
    private val mutex = Mutex()
    private val cache = HashMap<String, Entry>()

    private class Entry(
        val result: EstimatedRewardsResult,
        val fetchedAtMillis: Long,
    )

    /**
     * Fetches the campaigns and the server-selected best reward.
     *
     * @param currency read from [id.frak.sdk.core.FrakMetadata], never from a
     *   caller and never from the device locale, so every surface agrees.
     * @param targetInteraction narrows selection to campaigns with this
     *   trigger. Open on the wire; an unrecognised value simply matches
     *   nothing, so it degrades to "no best reward" rather than erroring.
     */
    suspend fun fetch(
        merchantId: String,
        currency: FrakCurrency,
        targetInteraction: String?,
        audience: RewardAudience?,
        forceRefresh: Boolean,
    ): EstimatedRewardsResult {
        val key = cacheKey(merchantId, currency, targetInteraction, audience)

        if (!forceRefresh) {
            mutex
                .withLock {
                    cache[key]?.takeIf { now() - it.fetchedAtMillis < CACHE_TTL_MILLIS }
                }?.let { return it.result }
        }

        if (mutex.withLock { backoff.isBackingOff(key) }) {
            throw FrakError.Network(IllegalStateException("backing off after repeated reward fetch failures"))
        }

        return singleFlight.run(key) {
            request(key, merchantId, currency, targetInteraction, audience)
        }
    }

    private suspend fun request(
        key: String,
        merchantId: String,
        currency: FrakCurrency,
        targetInteraction: String?,
        audience: RewardAudience?,
    ): EstimatedRewardsResult {
        val response =
            backoff.runOrRecordFailure(mutex, key) {
                http.get(
                    REWARDS_PATH,
                    mapOf(
                        "merchantId" to merchantId,
                        // Literal string "1": the backend declares this as
                        // t.Literal("1"), not a boolean; omitting it drops the
                        // `best` object entirely, which looks like "no rewards".
                        "formatted" to FORMATTED,
                        "currency" to currency.wireValue,
                        "targetInteraction" to targetInteraction,
                        "audience" to audience?.wireValue,
                    ),
                )
            }

        if (!response.isSuccess) {
            backoff.recordFailureAndThrow(mutex, key, response.toServerError())
        }

        val result = RewardsDecoder.decode(response.body)

        // This endpoint never 404s: an unknown merchantId returns
        // 200 {"rewards": []}, indistinguishable from a merchant with no live
        // campaigns. The diagnosis lives on resolveConfig(), which does 404.
        if (result.campaigns.isEmpty()) {
            logger.debug(
                "Frak: no active campaigns for merchant $merchantId. " +
                    "This endpoint cannot distinguish an unknown merchant from one with no campaigns — " +
                    "if this is unexpected, check resolveConfig() succeeds.",
            )
        }

        mutex.withLock {
            backoff.recordSuccess(key)
            cache[key] = Entry(result, now())
        }
        return result
    }

    // Every query parameter is in the key: `best` is selected server-side from
    // the query, so two calls differing only in audience return genuinely
    // different answers.
    private fun cacheKey(
        merchantId: String,
        currency: FrakCurrency,
        targetInteraction: String?,
        audience: RewardAudience?,
    ): String =
        buildString {
            append(merchantId).append(':')
            append(currency.wireValue).append(':')
            append(targetInteraction.orEmpty()).append(':')
            append(audience?.wireValue.orEmpty())
        }

    companion object {
        const val REWARDS_PATH: String = "/user/merchant/estimated-rewards"
        const val CACHE_TTL_MILLIS: Long = 30_000
        private const val FORMATTED = "1"
    }
}
