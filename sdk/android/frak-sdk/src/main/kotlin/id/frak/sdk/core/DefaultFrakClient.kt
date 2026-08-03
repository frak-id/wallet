package id.frak.sdk.core

import id.frak.sdk.FrakClient
import id.frak.sdk.OpenAppResult
import id.frak.sdk.applink.AppLauncher
import id.frak.sdk.applink.InstallLinks
import id.frak.sdk.applink.ReferralArrival
import id.frak.sdk.config.ConfigStore
import id.frak.sdk.config.FrakResolvedConfig
import id.frak.sdk.config.KeyValueStore
import id.frak.sdk.config.MerchantQuery
import id.frak.sdk.identity.AnonymousIdStore
import id.frak.sdk.identity.ProofOp
import id.frak.sdk.net.HttpClient
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.rewards.Campaign
import id.frak.sdk.rewards.RewardAudience
import id.frak.sdk.rewards.RewardRepository
import id.frak.sdk.sharing.FrakContext
import id.frak.sdk.sharing.SharingLinkBuilder
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.tracking.EventQueue
import id.frak.sdk.tracking.Interaction
import id.frak.sdk.tracking.InteractionTracker
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** The real [FrakClient]. Every public entry point lets only [FrakError]/`CancellationException` escape, see [frakCall]. */
internal class DefaultFrakClient(
    private val settings: FrakConfig,
    store: KeyValueStore,
    queue: EventQueue,
    private val identity: AnonymousIdStore,
    private val launcher: AppLauncher,
    private val logger: FrakLogger,
    private val ioDispatcher: CoroutineDispatcher = defaultIoDispatcher(),
    http: HttpClient = HttpClient(baseUrl = settings.env.backend, ioDispatcher = defaultNetworkDispatcher()),
) {
    /** Outlives the caller that started the work. SupervisorJob isolates a failed revalidation. */
    private val scope =
        CoroutineScope(
            SupervisorJob() +
                ioDispatcher +
                CoroutineExceptionHandler { _, throwable ->
                    logger.error("Frak background work failed", throwable)
                },
        )

    private val configStore = ConfigStore(http, store, logger, scope, ioDispatcher)
    private val rewards = RewardRepository(http, logger, scope)
    private val tracker =
        InteractionTracker(queue, http, logger, scope, currentClientId = { identity.anonymousId() })

    private val configState = MutableStateFlow<FrakResolvedConfig?>(null)

    val configUpdates: StateFlow<FrakResolvedConfig?> = configState.asStateFlow()

    val environment: FrakEnvironment get() = settings.env

    /** Read by `Frak.preloadSharing`. Not on [FrakClient] itself: that would break every hand-written fake. */
    internal val preloadSharing: Boolean get() = settings.preloadSharing

    val anonymousId: String?
        get() = identity.anonymousId()

    fun resetAnonymousId() {
        identity.reset()
        // Purge is best-effort cleanup; the guarantee is the flush loop dropping events
        // whose captured id no longer matches current.
        scope.launch { tracker.purge() }
    }

    init {
        scope.launch {
            if (!settings.trackingEnabled) {
                // Events captured before the merchant turned tracking off must not be sent now.
                tracker.purge()
                return@launch
            }
            // Warms the keystore read here so a later main-thread `anonymousId` read is a field access.
            identity.anonymousId()
            tracker.flush()
        }
    }

    // resolveConfig/campaigns/bestReward deliberately do NOT wrap themselves in
    // withContext(ioDispatcher): tried and reverted, since it moved dispatch outside frakCall's
    // error boundary. The pool-starvation half of that reasoning is now handled by giving
    // HttpClient its own dispatcher; this half still stands on its own.
    suspend fun resolveConfig(forceRefresh: Boolean = false): FrakResolvedConfig =
        frakCall {
            requireTrackingEnabled()
            val resolved = configStore.resolve(MerchantQuery.from(settings), forceRefresh)
            configState.value = resolved
            resolved
        }

    suspend fun campaigns(forceRefresh: Boolean = false): List<Campaign> =
        frakCall {
            fetchRewards(null, null, forceRefresh).campaigns
        }

    suspend fun bestReward(
        targetInteraction: String? = null,
        audience: RewardAudience? = null,
        forceRefresh: Boolean = false,
        products: List<ProductDetails>? = null,
    ): BestReward? =
        frakCall {
            fetchRewards(targetInteraction, audience, forceRefresh, products).best
        }

    suspend fun buildSharingLink(request: SharingRequest): String? =
        frakCall {
            val clientId = identity.anonymousId() ?: return@frakCall null
            // catch (FrakError), never runCatching: this suspends, and runCatching would also
            // swallow a caller's CancellationException, which frakCall must never let happen.
            val resolved =
                try {
                    resolveConfig()
                } catch (unavailable: FrakError) {
                    null
                }
            val merchantId = settings.merchantId ?: resolved?.merchantId ?: return@frakCall null
            val product = request.products.firstOrNull()
            val baseUrl =
                request.link
                    ?: product?.link
                    ?: resolved?.sdkConfig?.homepageLink
                    ?: settings.metadata.homepageLink
                    ?: return@frakCall null

            SharingLinkBuilder.build(
                baseUrl = baseUrl,
                context =
                    FrakContext.V2(
                        merchantId = merchantId,
                        timestamp = System.currentTimeMillis() / 1000,
                        clientId = clientId,
                    ),
                attribution = request.attribution,
                defaults = resolved?.sdkConfig?.attribution,
                productUtmContent = product?.utmContent,
            )
        }

    suspend fun track(interaction: Interaction): FrakResult<Unit> =
        trackingCall { merchantId ->
            tracker.track(merchantId, identity.anonymousId(), interaction)
            FrakResult.Success(Unit)
        }

    suspend fun trackPurchase(
        customerId: String,
        orderId: String,
        token: String,
    ): FrakResult<Unit> =
        trackingCall { merchantId ->
            tracker.trackPurchase(merchantId, identity.anonymousId(), customerId, orderId, token)
            FrakResult.Success(Unit)
        }

    /** Fire-and-forget, for the deep-link observer callback which cannot suspend. */
    internal fun handleReferralLinkInBackground(url: String) {
        scope.launch { handleReferralLink(url) }
    }

    suspend fun handleReferralLink(url: String): Boolean =
        frakCall {
            if (settings.deepLink == DeepLinkHandling.Disabled) return@frakCall false
            val context = SharingLinkBuilder.parse(url) ?: return@frakCall false

            if (ReferralArrival.isSelfReferral(context, identity.anonymousId())) {
                logger.info("Ignoring a referral link this device produced.")
                return@frakCall true
            }

            track(ReferralArrival.arrivalFrom(context))
            true
        }

    fun isFrakAppInstalled(): Boolean = launcher.isInstalled(settings.env.walletPackageId)

    suspend fun openFrakApp(): OpenAppResult =
        frakCall {
            val link = installIdentity() ?: return@frakCall OpenAppResult.Failed
            val (merchantId, anonymousId) = link

            // Attempted rather than gated on the probe: `isInstalled` can be false for reasons
            // unrelated to the app being absent, and `startActivity` already reports whether
            // anything took the intent. Mirrors iOS, where the probe is the weaker signal by a
            // wider margin — there it needs a merchant-side plist entry the SDK cannot inject.
            if (launcher.open(InstallLinks.deepLink(settings.env.walletScheme, merchantId, anonymousId))) {
                return@frakCall OpenAppResult.OpenedApp
            }

            val store = storeUrl(merchantId, anonymousId)
            if (launcher.open(store)) OpenAppResult.OpenedStore else OpenAppResult.Failed
        }

    suspend fun installUrl(): String? =
        frakCall {
            val (merchantId, anonymousId) = installIdentity() ?: return@frakCall null
            storeUrl(merchantId, anonymousId)
        }

    suspend fun installPageUrl(
        returnScheme: String,
        sessionId: String,
    ): String? =
        frakCall {
            val (merchantId, anonymousId) = installIdentity() ?: return@frakCall null
            // Minted here rather than when the sheet opens: most sessions never reach the
            // install step, a keystore signature can fail for reasons that have nothing to do
            // with sharing, and the backend's 30-day window runs from this timestamp.
            InstallLinks.installPage(
                walletOrigin = settings.env.wallet,
                merchantId = merchantId,
                anonymousId = anonymousId,
                returnScheme = returnScheme,
                sessionId = sessionId,
                proof = identity.signProof(ProofOp.Install, merchantId),
            )
        }

    /** The merchant/anonymous-id pair an install link needs, or null when either is missing. */
    private suspend fun installIdentity(): Pair<String, String>? {
        val anonymousId = identity.anonymousId() ?: return null
        val merchantId =
            settings.merchantId
                ?: try {
                    resolveConfig().merchantId
                } catch (unavailable: FrakError) {
                    null
                }
                ?: return null
        return merchantId to anonymousId
    }

    private fun storeUrl(
        merchantId: String,
        anonymousId: String,
    ): String =
        InstallLinks.playStore(
            packageId = settings.env.walletPackageId,
            merchantId = merchantId,
            anonymousId = anonymousId,
            installProof = identity.signProof(ProofOp.Install, merchantId),
        )

    /** Only ever fails for a reason that won't resolve itself; connectivity is the queue's problem. */
    private suspend inline fun trackingCall(block: (merchantId: String) -> FrakResult<Unit>): FrakResult<Unit> =
        try {
            requireTrackingEnabled()
            block(settings.merchantId ?: resolveConfig().merchantId)
        } catch (known: FrakError) {
            FrakResult.Failure(known)
        }

    /** Resolve first so a typo'd merchant id surfaces as [FrakError.MerchantResolutionFailed]. */
    private suspend fun fetchRewards(
        targetInteraction: String?,
        audience: RewardAudience?,
        forceRefresh: Boolean,
        products: List<ProductDetails>? = null,
    ) = rewards.fetch(
        merchantId = resolveConfig(forceRefresh = false).merchantId,
        currency = settings.metadata.currency,
        targetInteraction = targetInteraction,
        audience = audience,
        forceRefresh = forceRefresh,
        products = products,
    )

    private fun requireTrackingEnabled() {
        if (!settings.trackingEnabled) throw FrakError.TrackingDisabled
    }
}

/**
 * Caps the SDK's share of the shared IO pool so a burst doesn't starve the host's own disk I/O.
 * `internal`, not private: [id.frak.sdk.Frak] must hand the EventQueue this exact same instance,
 * not a second independent `limitedParallelism(2)` budget.
 */
@OptIn(ExperimentalCoroutinesApi::class)
internal fun defaultIoDispatcher(): CoroutineDispatcher = Dispatchers.IO.limitedParallelism(2)

/**
 * Separate budget for [HttpClient], whose `perform()` blocks its thread for the whole request
 * (up to a 20s deadline). Sharing one budget with disk I/O means two concurrent requests stall
 * every cache read and queue flush until they finish.
 */
@OptIn(ExperimentalCoroutinesApi::class)
internal fun defaultNetworkDispatcher(): CoroutineDispatcher = Dispatchers.IO.limitedParallelism(4)

/** Normalises whatever escapes so only [FrakError] leaves the SDK. `CancellationException` rethrows untouched. */
internal inline fun <T> frakCall(block: () -> T): T =
    try {
        block()
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (known: FrakError) {
        throw known
    } catch (unexpected: Throwable) {
        throw FrakError.Decoding("unexpected failure: ${unexpected.message}", unexpected)
    }
