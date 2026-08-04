package id.frak.sdk

import android.app.Application
import android.content.Context
import id.frak.sdk.applink.AndroidAppLauncher
import id.frak.sdk.applink.DeepLinkObserver
import id.frak.sdk.config.SharedPreferencesStore
import id.frak.sdk.core.DeepLinkHandling
import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakEnvironment
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.core.TrackingConsent
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
 * val reward = Frak.client.rewards.best(targetInteraction = "purchase")
 * ```
 */
public object Frak {
    @Volatile
    private var core: DefaultFrakClient? = null

    @Volatile
    private var instance: FrakClient? = null

    /** Registered lifecycle observer, so [shutdown] can unregister it; otherwise a re-initialize cycle double-handles every inbound deep link. */
    @Volatile
    private var deepLinkObserver: Pair<Application, Application.ActivityLifecycleCallbacks>? = null

    /** Non-blocking, does no I/O, never throws. Second call is a no-op; first config wins. */
    @JvmStatic
    public fun initialize(
        context: Context,
        config: FrakConfig,
    ) {
        val logger = FrakLogger(config.logLevel, config.logSink)
        if (core != null) {
            logger.warn("Frak.initialize was called more than once. The first configuration is kept.")
            return
        }
        synchronized(this) {
            if (core != null) return
            val effective = config.withPackageIdFrom(context)
            if (effective.merchantId == null && effective.packageId == null) {
                logger.error(
                    "FrakConfig has neither a merchantId nor a packageId. " +
                        "Every SDK call will fail with MerchantResolutionFailed.",
                )
            }
            (effective.env as? FrakEnvironment.Custom)?.rejectionReason?.let { reason ->
                logger.error("FrakEnvironment.Custom: $reason Requests will fail with FrakError.Network.")
            }
            // Shared by queue and client: two limitedParallelism(2) views would double the IO budget.
            val ioDispatcher = defaultIoDispatcher()
            // Separate prefs file from the config cache: a corrupt write to the hot one must not
            // take identity — or the consent decision — with it.
            val identityStore = SharedPreferencesStore(context, IDENTITY_FILE_NAME)
            // ONE instance, shared by the client and the identity store. Two would memoise the
            // persisted decision independently and drift the moment setTrackingEnabled is called.
            val consent =
                TrackingConsent(
                    store = identityStore,
                    configDefault = effective.trackingEnabled,
                    logger = logger,
                    ioDispatcher = ioDispatcher,
                )
            val newCore =
                DefaultFrakClient(
                    settings = effective,
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
                            store = identityStore,
                            logger = logger,
                            merchantMarker = effective.merchantId ?: effective.packageId.orEmpty(),
                            consent = consent,
                            ioDispatcher = ioDispatcher,
                        ),
                    consent = consent,
                    launcher = AndroidAppLauncher(context),
                    logger = logger,
                    ioDispatcher = ioDispatcher,
                )
            core = newCore
            instance = FrakClient(newCore)
            registerDeepLinkObserver(context, effective, logger)
            logger.info("Frak ${FrakSdkVersion.CURRENT} initialized.")
        }
    }

    /**
     * Tears the SDK down: cancels background coroutines, unregisters the deep-link observer, and
     * drops the client so [initialize] can run again with a different [FrakConfig].
     *
     * Not a privacy control — use [FrakClient.setTrackingEnabled] for that; this neither records
     * a consent decision nor erases anything.
     *
     * Idempotent and safe before [initialize]. Suspends until the background work has stopped.
     *
     * No `@JvmStatic`: a `suspend fun` compiles to a method taking a `Continuation`, which no
     * Java caller can supply.
     */
    public suspend fun shutdown() {
        // State is read and cleared under the lock, then acted on outside it: `synchronized`
        // must never span a suspension point.
        val (dying, observer) =
            synchronized(this) {
                val client = core
                val registration = deepLinkObserver
                core = null
                instance = null
                deepLinkObserver = null
                client to registration
            }
        observer?.let { (application, callbacks) ->
            application.unregisterActivityLifecycleCallbacks(callbacks)
        }
        dying?.shutdown()
    }

    /** @throws FrakError.NotInitialized when [initialize] has not run. */
    @JvmStatic
    public val client: FrakClient
        get() = instance ?: throw FrakError.NotInitialized()

    /** Same as [client], but null instead of throwing (A6): for a call site that would just null-check anyway. */
    @JvmStatic
    public val clientOrNull: FrakClient?
        get() = instance

    /** Whether [initialize] has run. For merchants guarding optional integrations. */
    @JvmStatic
    public val isInitialized: Boolean
        get() = instance != null

    /** Mirrors [FrakConfig.preloadSharing] for `:frak-sdk-ui`. False before [initialize] has run. */
    @JvmStatic
    public val preloadSharing: Boolean
        get() = core?.preloadSharing ?: false

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
        // Client owns the guard/tracking; this only reports that a link was seen.
        val callbacks = DeepLinkObserver { url -> core?.handleReferralLinkInBackground(url) }
        application.registerActivityLifecycleCallbacks(callbacks)
        // Retained so [shutdown] can unregister it; see the field's doc for what leaking it costs.
        deepLinkObserver = application to callbacks
    }

    private fun FrakConfig.withPackageIdFrom(context: Context): FrakConfig {
        if (merchantId != null || packageId != null) return this
        return withPackageId(context.packageName)
    }

    /** Matches the `path` in `frak_data_extraction_rules.xml`. */
    private const val IDENTITY_FILE_NAME = "id.frak.sdk"

    private const val EVENT_QUEUE_FILE_NAME = "frak-events.jsonl"
}
