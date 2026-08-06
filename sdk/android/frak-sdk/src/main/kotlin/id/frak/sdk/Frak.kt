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
 * Entry point. Call [initialize] once, then use [client].
 *
 * ```kotlin
 * // Application.onCreate
 * Frak.initialize(
 *     this,
 *     FrakConfig(BuildConfig.FRAK_MERCHANT_ID) {
 *         metadata = FrakMetadata {
 *             name = "Acme"
 *             currency = FrakCurrency.EUR
 *         }
 *     },
 * )
 *
 * // anywhere afterwards
 * val reward = Frak.client.rewards.best(RewardRequest { targetInteraction = "purchase" })
 * ```
 *
 * ```java
 * // Application.onCreate, from Java — the same Builder the Kotlin form above delegates to
 * Frak.initialize(
 *         this,
 *         new FrakConfig.Builder(BuildConfig.FRAK_MERCHANT_ID)
 *                 .metadata(new FrakMetadata.Builder().name("Acme").currency(FrakCurrency.EUR).build())
 *                 .build());
 *
 * // and afterwards, from Java: every suspending member has a CompletableFuture twin
 * Frak.getClient().getRewards()
 *         .bestAsync(new RewardRequest.Builder().targetInteraction("purchase").build())
 *         .thenAccept(reward -> { /* on the main thread */ });
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
     * No `@JvmStatic` on this one: a `suspend fun` compiles to a method taking a `Continuation`, which
     * no Java caller can supply. Java uses [shutdownAsync].
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

    /**
     * [shutdown] for Java.
     *
     * **The one `*Async` twin that does not run on the client's own scope**, and it cannot. Every other
     * twin borrows the `SupervisorJob` that `shutdown()` cancels, so that a teardown cancels work in
     * flight rather than leaking it. Routing *this* one through the same scope would mean the future is
     * cancelled by the very work it is awaiting: `isCancelled` would be true, and a Java caller's
     * `thenRun(::finishTeardown)` would never fire. So teardown gets its own scope, which nothing
     * cancels.
     *
     * Completes on the main thread, like the others, and with `null` rather than `Unit` — see
     * [FrakClient.setTrackingEnabledAsync]. **Never `get()`/`join()` it on the main thread**, for the
     * reason given on [id.frak.sdk.core.DefaultFrakClient.asFuture].
     *
     * Two caveats [shutdown] shares and this one makes reachable, both recorded rather than fixed.
     * [shutdown] clears its state under a lock and then acts outside it, so a *second* concurrent
     * caller sees nothing to tear down and completes while the first is still cancelling — which makes
     * "suspends until the background work has stopped" true only for the first caller. And because this
     * returns immediately, `Frak.shutdownAsync(); Frak.initialize(…)` back to back — the natural Java
     * spelling — can build a new client while the old one is mid-`cancelAndJoin`. Sequence the second
     * call off the future (`thenRun`) rather than beside it.
     *
     * Unlike the client's twins this one has no injectable dispatcher, so it reaches
     * `Looper.getMainLooper()` and is therefore unreachable from `:frak-sdk`'s JVM suite:
     * `AsyncTwinTest` covers `asFuture`, not this. `FrakSdkJavaCallSiteFixture` proves it is nameable
     * and `@JvmStatic`; nothing proves it runs.
     */
    @JvmStatic
    public fun shutdownAsync(): CompletableFuture<Void?> =
        teardownScope.future(MainThreadDispatcher) {
            shutdown()
            null
        }

    /**
     * Not the client's scope, deliberately: see [shutdownAsync]. `SupervisorJob` so one failed teardown
     * cannot poison the next, and no dispatcher of its own — `shutdown()` is `cancelAndJoin` plus a
     * `SharedPreferences`-free unregister, and the `future(MainThreadDispatcher)` above pins where it
     * resumes.
     */
    private val teardownScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

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
