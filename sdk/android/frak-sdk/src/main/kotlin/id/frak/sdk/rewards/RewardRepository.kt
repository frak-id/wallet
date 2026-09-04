package id.frak.sdk.rewards

import id.frak.sdk.config.Backoff
import id.frak.sdk.config.SingleFlight
import id.frak.sdk.core.Base64Url
import id.frak.sdk.core.FrakCurrency
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.core.MILLIS_PER_SECOND
import id.frak.sdk.core.ProductDetails
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

    /**
     * Test-only window onto the cache's size. The products string makes the key space
     * caller-controlled, so "the map stays bounded" is a property worth asserting rather than
     * trusting.
     */
    suspend fun cachedEntryCount(): Int = mutex.withLock { cache.size }

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
     * @param products advisory product context for selection; see
     *   [id.frak.sdk.RewardsApi.best].
     */
    suspend fun fetch(
        merchantId: String,
        currency: FrakCurrency,
        targetInteraction: String?,
        audience: RewardAudience?,
        forceRefresh: Boolean,
        products: List<ProductDetails>? = null,
    ): EstimatedRewardsResult {
        val encodedProducts = encodeProducts(products)
        val key = cacheKey(merchantId, currency, targetInteraction, audience, encodedProducts)
        // Deliberately products-free: backoff is a statement about the backend's health, not
        // one product set. Folding products in would mint a fresh key with a zero failure count
        // on every product page.
        val backoffKey = cacheKey(merchantId, currency, targetInteraction, audience, null)

        if (!forceRefresh) {
            mutex
                .withLock {
                    cache[key]?.takeIf { now() - it.fetchedAtMillis < CACHE_TTL_MILLIS }
                }?.let { return it.result }
        }

        mutex.withLock { backoff.remainingMillis(backoffKey) }?.let {
            throw FrakError.BackingOff(it / MILLIS_PER_SECOND)
        }

        return singleFlight.run(key) {
            request(key, backoffKey, merchantId, currency, targetInteraction, audience, encodedProducts)
        }
    }

    private suspend fun request(
        key: String,
        backoffKey: String,
        merchantId: String,
        currency: FrakCurrency,
        targetInteraction: String?,
        audience: RewardAudience?,
        encodedProducts: String?,
    ): EstimatedRewardsResult {
        val response =
            backoff.runOrRecordFailure(mutex, backoffKey) {
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
                        "products" to encodedProducts,
                    ),
                )
            }

        if (!response.isSuccess) {
            backoff.recordFailureAndThrow(mutex, backoffKey, response.toServerError())
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
            backoff.recordSuccess(backoffKey)
            // Sweep before inserting: `products` puts a caller-controlled string in the key, so
            // the map is no longer bounded by a handful of merchant/currency/audience
            // combinations. Dropping expired entries here bounds it to one TTL window.
            val cutoff = now() - CACHE_TTL_MILLIS
            cache.values.removeAll { it.fetchedAtMillis <= cutoff }
            cache[key] = Entry(result, now())
        }
        return result
    }

    // Every query parameter is in the key: `best` is selected server-side from
    // the query, so two calls differing only in audience (or products) return
    // genuinely different answers.
    private fun cacheKey(
        merchantId: String,
        currency: FrakCurrency,
        targetInteraction: String?,
        audience: RewardAudience?,
        encodedProducts: String?,
    ): String =
        buildString {
            append(merchantId).append(':')
            append(currency.wireValue).append(':')
            append(targetInteraction.orEmpty()).append(':')
            append(audience?.wireValue.orEmpty()).append(':')
            append(encodedProducts.orEmpty())
        }

    /**
     * `base64url(utf8(JSON.stringify(products)))`, matching `sdk/core`'s `compressJsonToB64`
     * scheme so the backend's single decoder serves every SDK. Null fields and products with no
     * scope field at all are dropped.
     *
     * Built as a string directly, not via [JSONObject]: `org.json` backs it with a `HashMap`, so
     * iteration order is JVM-dependent, not insertion order. A fixed alphabetical order keeps the
     * encoded string deterministic across JVMs.
     *
     * Returns null for an empty list, or when the encoded string would exceed
     * [MAX_ENCODED_PRODUCTS_LENGTH]; selection falls back to unscoped rather than failing the call.
     */
    private fun encodeProducts(products: List<ProductDetails>?): String? {
        if (products.isNullOrEmpty()) return null

        val entries =
            products.mapNotNull { product ->
                val fields =
                    buildList {
                        product.name?.let { add("name" to it.jsonQuoted()) }
                        product.productId?.let { add("productId" to it.jsonQuoted()) }
                        // takeIf { it.isFinite() }: NaN/Infinity have no JSON literal; emitting
                        // toString() would make the payload unparseable. Dropping the field
                        // matches what JSON.stringify does.
                        product.quantity?.takeIf { it.isFinite() }?.let { add("quantity" to it.jsonNumber()) }
                        product.sku?.let { add("sku" to it.jsonQuoted()) }
                        product.totalPrice?.takeIf { it.isFinite() }?.let { add("totalPrice" to it.jsonNumber()) }
                        product.unitPrice?.takeIf { it.isFinite() }?.let { add("unitPrice" to it.jsonNumber()) }
                    }
                fields.takeIf { it.isNotEmpty() }
            }
        if (entries.isEmpty()) return null

        val json =
            entries.joinToString(separator = ",", prefix = "[", postfix = "]") { fields ->
                fields.joinToString(separator = ",", prefix = "{", postfix = "}") { (key, value) -> "\"$key\":$value" }
            }

        val encoded = Base64Url.encode(json.toByteArray(Charsets.UTF_8))
        if (encoded.length > MAX_ENCODED_PRODUCTS_LENGTH) {
            logger.warn(
                "Frak: bestReward(products=...) payload exceeds $MAX_ENCODED_PRODUCTS_LENGTH " +
                    "encoded characters and was dropped; selection falls back to unscoped.",
            )
            return null
        }
        return encoded
    }

    // JSONObject/JSONArray are avoided for the wire string itself (see encodeProducts); these
    // two are the minimal quoting this closed, controlled field set needs. Not a general-purpose
    // JSON writer — ProductDetails only ever carries a String or a Double here.
    private fun String.jsonQuoted(): String =
        buildString {
            append('"')
            for (char in this@jsonQuoted) {
                when (char) {
                    '"' -> {
                        append("\\\"")
                    }

                    '\\' -> {
                        append("\\\\")
                    }

                    // RFC 8259 §7: a raw control character inside a string is invalid JSON, and
                    // merchant catalogue data does carry stray newlines and tabs.
                    '\n' -> {
                        append("\\n")
                    }

                    '\r' -> {
                        append("\\r")
                    }

                    '\t' -> {
                        append("\\t")
                    }

                    '\b' -> {
                        append("\\b")
                    }

                    '\u000C' -> {
                        append("\\f")
                    }

                    else -> {
                        if (char < ' ') {
                            append("\\u%04x".format(char.code))
                        } else {
                            append(char)
                        }
                    }
                }
            }
            append('"')
        }

    // Matches JSON.stringify/org.json's own numberToString: an integral Double must not gain a
    // trailing ".0" — the golden vectors and every sibling-platform decoder assert on this.
    private fun Double.jsonNumber(): String =
        if (this == Math.floor(this) &&
            !isInfinite()
        ) {
            toLong().toString()
        } else {
            toString()
        }

    companion object {
        const val REWARDS_PATH: String = "/user/merchant/estimated-rewards"
        const val CACHE_TTL_MILLIS: Long = 30_000
        private const val FORMATTED = "1"

        /** Matches the backend's `PRODUCTS_PARAM_MAX_LENGTH`, which ignores a longer param. */
        const val MAX_ENCODED_PRODUCTS_LENGTH: Int = 8192
    }
}
