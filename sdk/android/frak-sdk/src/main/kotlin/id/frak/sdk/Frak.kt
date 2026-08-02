package id.frak.sdk

import android.content.Context
import id.frak.sdk.config.SharedPreferencesStore
import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogger

/**
 * Entry point. Call [initialize] once, then use [client].
 *
 * ```kotlin
 * // Application.onCreate
 * Frak.initialize(
 *     this,
 *     FrakConfig(
 *         merchantId = BuildConfig.FRAK_MERCHANT_ID,
 *         metadata = FrakMetadata(name = "Acme", currency = FrakCurrency.EUR),
 *     ),
 * )
 *
 * // anywhere afterwards
 * val reward = Frak.client.bestReward(targetInteraction = "purchase")
 * ```
 *
 * A singleton rather than an instance the merchant holds, matching the JS SDK
 * and both iOS and Android convention. A native app maps to exactly one
 * merchant, so there is no second instance to want.
 */
public object Frak {
    @Volatile
    private var instance: FrakClient? = null

    /**
     * Starts the SDK. Non-blocking, does no I/O, and never throws.
     *
     * A second call is a no-op and logs a warning; the first configuration
     * wins rather than the last, since swapping config underneath in-flight
     * work would be worse than rejecting the second call.
     *
     * @param context any [Context]; only the application context is retained.
     */
    @JvmStatic
    public fun initialize(
        context: Context,
        config: FrakConfig,
    ) {
        val logger = FrakLogger(config.logLevel, config.logSink)
        if (instance != null) {
            logger.warn("Frak.initialize was called more than once. The first configuration is kept.")
            return
        }
        synchronized(this) {
            // fast path without the lock
            if (instance != null) return
            val effective = config.withPackageIdFrom(context)
            if (effective.merchantId == null && effective.packageId == null) {
                logger.error(
                    "FrakConfig has neither a merchantId nor a packageId. " +
                        "Every SDK call will fail with MerchantResolutionFailed.",
                )
            }
            instance =
                DefaultFrakClient(
                    config = effective,
                    store = SharedPreferencesStore(context),
                    logger = logger,
                )
            logger.info("Frak ${FrakSdkVersion.CURRENT} initialized.")
        }
    }

    /**
     * The client.
     *
     * @throws FrakError.NotInitialized when [initialize] has not run.
     */
    @JvmStatic
    public val client: FrakClient
        get() = instance ?: throw FrakError.NotInitialized

    /** Whether [initialize] has run. For merchants guarding optional integrations. */
    @JvmStatic
    public val isInitialized: Boolean
        get() = instance != null

    // Fills in packageId from the Context when the merchant left it null (the
    // expected case); skipped once a merchantId is set, since packageId would
    // be inert at the backend anyway.
    private fun FrakConfig.withPackageIdFrom(context: Context): FrakConfig {
        if (merchantId != null || packageId != null) return this
        return withPackageId(context.packageName)
    }

    /** Drops the client, for tests. Internal so merchants cannot re-initialize at runtime. */
    internal fun resetForTesting() {
        synchronized(this) { instance = null }
    }
}
