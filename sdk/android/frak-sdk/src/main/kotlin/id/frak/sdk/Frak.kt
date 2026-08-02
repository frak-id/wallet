package id.frak.sdk

import android.app.Application
import android.content.Context
import id.frak.sdk.applink.AndroidAppLauncher
import id.frak.sdk.applink.DeepLinkObserver
import id.frak.sdk.config.SharedPreferencesStore
import id.frak.sdk.core.DeepLinkHandling
import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.core.defaultIoDispatcher
import id.frak.sdk.identity.AndroidKeystoreDeviceKeyStore
import id.frak.sdk.identity.AnonymousIdStore
import id.frak.sdk.sharing.FrakContext
import id.frak.sdk.sharing.SharingLinkBuilder
import id.frak.sdk.tracking.EventQueue
import java.io.File

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
 */
public object Frak {
    @Volatile
    private var instance: DefaultFrakClient? = null

    /** Non-blocking, does no I/O, never throws. Second call is a no-op; first config wins. */
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
            if (instance != null) return
            val effective = config.withPackageIdFrom(context)
            if (effective.merchantId == null && effective.packageId == null) {
                logger.error(
                    "FrakConfig has neither a merchantId nor a packageId. " +
                        "Every SDK call will fail with MerchantResolutionFailed.",
                )
            }
            // Shared by queue and client: two limitedParallelism(2) views would double the IO budget.
            val ioDispatcher = defaultIoDispatcher()
            instance =
                DefaultFrakClient(
                    config = effective,
                    store = SharedPreferencesStore(context),
                    // noBackupFilesDir: queued events must never be replayed from a backup/transfer.
                    queue =
                        EventQueue(
                            file = File(context.noBackupFilesDir, EVENT_QUEUE_FILE_NAME),
                            logger = logger,
                            ioDispatcher = ioDispatcher,
                        ),
                    identity =
                        AnonymousIdStore(
                            keyStore = AndroidKeystoreDeviceKeyStore(),
                            // Separate prefs file: a corrupt write to the config cache must not take identity with it.
                            store = SharedPreferencesStore(context, IDENTITY_FILE_NAME),
                            logger = logger,
                            merchantMarker = effective.merchantId ?: effective.packageId.orEmpty(),
                            trackingEnabled = effective.trackingEnabled,
                        ),
                    launcher = AndroidAppLauncher(context),
                    logger = logger,
                    ioDispatcher = ioDispatcher,
                )
            registerDeepLinkObserver(context, effective, logger)
            logger.info("Frak ${FrakSdkVersion.CURRENT} initialized.")
        }
    }

    /** @throws FrakError.NotInitialized when [initialize] has not run. */
    @JvmStatic
    public val client: FrakClient
        get() = instance ?: throw FrakError.NotInitialized

    /** Whether [initialize] has run. For merchants guarding optional integrations. */
    @JvmStatic
    public val isInitialized: Boolean
        get() = instance != null

    /** Mirrors [FrakConfig.preloadSharing] for `:frak-sdk-ui`. False before [initialize] has run. */
    @JvmStatic
    public val preloadSharing: Boolean
        get() = instance?.preloadSharing ?: false

    /** Pure and static; callable before [initialize]. Only decodes — does not track arrival. */
    @JvmStatic
    public fun parseReferralLink(url: String): FrakContext? = SharingLinkBuilder.parse(url)

    /** Needs an `Application` to observe lifecycles; falls back to manual routing otherwise. */
    private fun registerDeepLinkObserver(
        context: Context,
        config: FrakConfig,
        logger: FrakLogger,
    ) {
        if (config.deepLink != DeepLinkHandling.Automatic) return
        val application = context.applicationContext as? Application
        if (application == null) {
            logger.error(
                "DeepLinkHandling.Automatic needs an Application context. " +
                    "Inbound referral links will be ignored; call handleReferralLink from your own router.",
            )
            return
        }
        application.registerActivityLifecycleCallbacks(
            // Client owns the guard/tracking; this only reports that a link was seen.
            DeepLinkObserver { url -> instance?.handleReferralLinkInBackground(url) },
        )
    }

    private fun FrakConfig.withPackageIdFrom(context: Context): FrakConfig {
        if (merchantId != null || packageId != null) return this
        return withPackageId(context.packageName)
    }

    /** Drops the client, for tests. Internal so merchants cannot re-initialize at runtime. */
    internal fun resetForTesting() {
        synchronized(this) { instance = null }
    }

    /** Matches the `path` in `frak_data_extraction_rules.xml`. */
    private const val IDENTITY_FILE_NAME = "id.frak.sdk"

    private const val EVENT_QUEUE_FILE_NAME = "frak-events.jsonl"
}
