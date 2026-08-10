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
import id.frak.sdk.core.MainThreadDispatcher
import id.frak.sdk.core.TrackingConsent
import id.frak.sdk.core.defaultIoDispatcher
import id.frak.sdk.identity.AndroidKeystoreDeviceKeyStore
import id.frak.sdk.identity.AnonymousIdStore
import id.frak.sdk.sharing.FrakContext
import id.frak.sdk.sharing.SharingLinkBuilder
import id.frak.sdk.tracking.EventQueue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.future.future
import java.io.File
import java.util.concurrent.CompletableFuture

/**
 * Entry point. Call [initialize] once from `Application.onCreate`, then use [client].
 *
 * Java callers use `Frak.getClient()` and the `*Async` twin of every suspending member.
 */
public object Frak {
    /**
     * Everything one [initialize] built, swapped as a unit. Three separate fields let a reader
     * observe half a teardown, and left the "these always move together" invariant to code review.
     */
    private class Session(
        val core: DefaultFrakClient,
        val client: FrakClient,
        /** Kept so [shutdown] can unregister it; otherwise re-initializing double-handles inbound deep links. */
        val observer: Pair<Application, Application.ActivityLifecycleCallbacks>?,
    )

    @Volatile
    private var session: Session? = null

    /** Non-blocking, does no I/O, never throws. Second call is a no-op; first config wins. */
    @JvmStatic
    public fun initialize(
        context: Context,
        config: FrakConfig,
    ) {
        val logger = FrakLogger(config.logLevel, config.logSink)
        if (session != null) {
            logger.warn("Frak.initialize was called more than once. The first configuration is kept.")
            return
        }
        synchronized(this) {
            if (session != null) return
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
            // Separate prefs file from the config cache: a corrupt write must not take identity with it.
            val identityStore = SharedPreferencesStore(context, IDENTITY_FILE_NAME)
            // ONE instance, shared by the client and the identity store; two would drift on setTrackingEnabled.
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
            // Built before the session is published and registered after it: a callback that fired
            // against a half-built session would drop the link it was handed.
            val registration = createDeepLinkObserver(context, effective, logger)
            session = Session(core = newCore, client = FrakClient(newCore), observer = registration)
            registration?.let { (application, callbacks) ->
                application.registerActivityLifecycleCallbacks(callbacks)
            }
            logger.info("Frak ${FrakSdkVersion.CURRENT} initialized.")
        }
    }

    /**
     * Tears the SDK down: cancels background coroutines, unregisters the deep-link observer, and
     * drops the client so [initialize] can run again. Not a privacy control — use
     * [FrakClient.setTrackingEnabled] for that. Idempotent; Java uses [shutdownAsync].
     */
    public suspend fun shutdown() {
        // State is read and cleared under the lock, then acted on outside it: `synchronized` must
        // never span a suspension point.
        val dying =
            synchronized(this) {
                val current = session
                session = null
                current
            }
        dying?.observer?.let { (application, callbacks) ->
            application.unregisterActivityLifecycleCallbacks(callbacks)
        }
        dying?.core?.shutdown()
    }

    /**
     * [shutdown] for Java. Runs on its own scope, not the client's, which `shutdown()` cancels.
     * Never `get()`/`join()` it on the main thread, and sequence a following [initialize] off the
     * future (`thenRun`) rather than beside it, or the new client races the old one's teardown.
     */
    @JvmStatic
    public fun shutdownAsync(): CompletableFuture<Void?> =
        teardownScope.future(MainThreadDispatcher) {
            shutdown()
            null
        }

    /** Not the client's scope, deliberately: see [shutdownAsync]. */
    private val teardownScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /** @throws FrakError.NotInitialized when [initialize] has not run. */
    @JvmStatic
    public val client: FrakClient
        get() = session?.client ?: throw FrakError.NotInitialized()

    /** Same as [client], but null instead of throwing. */
    @JvmStatic
    public val clientOrNull: FrakClient?
        get() = session?.client

    /** Whether [initialize] has run. For merchants guarding optional integrations. */
    @JvmStatic
    public val isInitialized: Boolean
        get() = session != null

    /** Pure and static; callable before [initialize]. Only decodes — does not track arrival. */
    @JvmStatic
    public fun parseReferralLink(url: String): FrakContext? = SharingLinkBuilder.parse(url)

    /**
     * Builds the observer without registering it, so [initialize] controls when it goes live.
     * Needs an `Application` to observe lifecycles; falls back to manual routing otherwise.
     */
    private fun createDeepLinkObserver(
        context: Context,
        config: FrakConfig,
        logger: FrakLogger,
    ): Pair<Application, Application.ActivityLifecycleCallbacks>? {
        if (config.deepLink != DeepLinkHandling.Automatic) return null
        val application = context.applicationContext as? Application
        if (application == null) {
            logger.error(
                "DeepLinkHandling.Automatic needs an Application context. " +
                    "Inbound referral links will be ignored; call handleReferralLink from your own router.",
            )
            return null
        }
        // Client owns the guard/tracking; this only reports that a link was seen. Reads the session
        // at call time, so a link arriving after [shutdown] reports nowhere instead of to a dead client.
        return application to DeepLinkObserver { url -> session?.core?.handleReferralLinkInBackground(url) }
    }

    private fun FrakConfig.withPackageIdFrom(context: Context): FrakConfig {
        if (merchantId != null || packageId != null) return this
        return withPackageId(context.packageName)
    }

    /**
     * Holds the merchant marker AND the consent decision, which is why this file is deliberately
     * left in Auto Backup: a withdrawal must survive a device transfer. The identity itself is not
     * in here — the keypair lives in `AndroidKeyStore` and cannot be backed up or transferred at
     * all — so there is nothing here to exclude. See `PRIVACY.md`.
     */
    private const val IDENTITY_FILE_NAME = "id.frak.sdk"

    private const val EVENT_QUEUE_FILE_NAME = "frak-events.jsonl"
}
