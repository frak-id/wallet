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
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.future.future
import kotlinx.coroutines.job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.CompletableFuture

/** The real [FrakClient]. Every entry point lets only [FrakError]/`CancellationException` escape, see [frakCall]. */
internal class DefaultFrakClient(
    private val settings: FrakConfig,
    store: KeyValueStore,
    queue: EventQueue,
    private val identity: AnonymousIdStore,
    /** Must be the same instance [identity] holds, or the two memoise independently and drift. */
    private val consent: TrackingConsent,
    private val launcher: AppLauncher,
    private val logger: FrakLogger,
    private val ioDispatcher: CoroutineDispatcher = defaultIoDispatcher(),
    /** What the Java `*Async` twins complete on. See [MainThreadDispatcher]. */
    private val mainDispatcher: CoroutineDispatcher = MainThreadDispatcher,
    http: HttpClient =
        HttpClient(
            baseUrl = settings.env.backend,
            ioDispatcher = defaultNetworkDispatcher(),
            logger = logger,
        ),
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
        InteractionTracker(
            queue,
            http,
            logger,
            scope,
            currentClientId = { identity.anonymousId() },
            // Read per event inside the drain, so a mid-drain withdrawal stops the upload.
            trackingAllowed = { consent.isEnabled() },
        )

    /**
     * Builds a Java `*Async` twin: body on [ioDispatcher], completion signalled on [mainDispatcher].
     * Never `get()`/`join()` one on the main thread — completion needs a main-looper turn, so it
     * deadlocks into an ANR. Cancelled by [shutdown], which leaves later twins already cancelled.
     */
    fun <T> asFuture(block: suspend () -> T): CompletableFuture<T> =
        scope.future(mainDispatcher, CoroutineStart.UNDISPATCHED) {
            withContext(ioDispatcher) { block() }
        }

    val environment: FrakEnvironment get() = settings.env

    /** Suspend because the first read may mint a keypair. */
    suspend fun anonymousId(): String? = identity.anonymousId()

    /** Returns false when the keystore refused to erase the key, i.e. the id did not rotate. */
    suspend fun resetAnonymousId(): Boolean {
        // Only purge on confirmed erasure, or events queued for a still-current id are lost.
        val erased = identity.reset()
        if (erased) {
            scope.launch { tracker.purge() }
        }
        return erased
    }

    /**
     * Runtime half of [FrakConfig.trackingEnabled]; the decision is persisted. Disabling purges the
     * queue but keeps the keypair, so a later opt-in can reuse it.
     */
    suspend fun setTrackingEnabled(enabled: Boolean) {
        consent.setEnabled(enabled)
        if (!enabled) tracker.purge()
    }

    /** The effective state: [FrakConfig.trackingEnabled] AND the persisted decision. See [TrackingConsent]. */
    suspend fun isTrackingEnabled(): Boolean = consent.isEnabled()

    /**
     * Cancels and awaits every background coroutine this client owns. Idempotent, with no restart
     * contract; `track` still enqueues afterwards, only the drain is gone. Not a privacy control —
     * [setTrackingEnabled] is.
     */
    suspend fun shutdown() {
        // Join, so a caller never returns while a drain is still unwinding.
        scope.coroutineContext.job.cancelAndJoin()
    }

    init {
        // Mints the keypair up front; a no-op when consent is withdrawn.
        identity.startEagerGeneration(scope)
        scope.launch {
            if (!consent.isEnabled()) {
                // Events captured before tracking was turned off must not be sent now.
                tracker.purge()
                return@launch
            }
            tracker.flush()
        }
    }

    // resolveConfig/campaigns/bestReward take no withContext(ioDispatcher): that would move
    // dispatch outside frakCall's error boundary. Not gated on consent either — these requests
    // carry no user identifier.
    suspend fun resolveConfig(forceRefresh: Boolean = false): FrakResolvedConfig =
        frakCall {
            configStore.resolve(MerchantQuery.from(settings), forceRefresh)
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
            // Not runCatching: it would also swallow the caller's CancellationException.
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
                        // Links minted here never carry a wallet address; that field is inbound-only.
                        wallet = null,
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

    /**
     * Returns whether this was a referral link. Never throws, so arrival tracking cannot take a
     * merchant's URL routing down with it.
     */
    suspend fun handleReferralLink(url: String): Boolean {
        if (settings.deepLink == DeepLinkHandling.Disabled) return false
        val context = SharingLinkBuilder.parse(url) ?: return false

        // currentConfig, not updates.value: a cold start launched by this very URL never called
        // resolve(). Guarded throughout, since this function must never throw.
        val ownMerchantId =
            settings.merchantId ?: runCatching {
                configStore.currentConfig(MerchantQuery.from(settings))?.merchantId
            }.getOrElse { failure ->
                if (failure is CancellationException) throw failure
                null
            }
        if (ReferralArrival.shouldIgnoreArrival(context, identity.anonymousId(), ownMerchantId)) {
            logger.info("Ignoring a self- or foreign-merchant referral link.")
            return true
        }

        try {
            track(ReferralArrival.arrivalFrom(context))
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (unexpected: Throwable) {
            logger.error("Referral arrival tracking failed", unexpected)
        }
        return true
    }

    fun isFrakAppInstalled(): Boolean = launcher.isInstalled(settings.env.walletPackageId)

    suspend fun openFrakApp(): OpenAppResult =
        frakCall {
            val link = installIdentity() ?: return@frakCall OpenAppResult.Failed
            val (merchantId, anonymousId) = link

            // Minted once for whichever arm takes it; null when the keystore cannot sign.
            val proof = identity.signProof(ProofOp.Install, merchantId)

            // Attempted rather than gated on isInstalled, which can be false for unrelated reasons.
            val deepLink =
                InstallLinks.deepLink(
                    scheme = settings.env.walletScheme,
                    merchantId = merchantId,
                    anonymousId = anonymousId,
                    installProof = proof,
                )
            if (launcher.open(deepLink)) {
                return@frakCall OpenAppResult.OpenedApp
            }

            val store = storeUrl(merchantId, anonymousId, proof)
            if (launcher.open(store)) OpenAppResult.OpenedStore else OpenAppResult.Failed
        }

    suspend fun installPageUrl(
        returnScheme: String,
        sessionId: String,
    ): String? =
        frakCall {
            val (merchantId, anonymousId) = installIdentity() ?: return@frakCall null
            // Minted here, not at sheet open: the backend's 30-day window runs from this timestamp.
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

    /** [installProof] has no default: a suspend call cannot be a default-parameter expression. */
    private fun storeUrl(
        merchantId: String,
        anonymousId: String,
        installProof: String?,
    ): String =
        InstallLinks.playStore(
            packageId = settings.env.walletPackageId,
            merchantId = merchantId,
            anonymousId = anonymousId,
            installProof = installProof,
        )

    /** Routed through [frakCall] so an unexpected `Throwable` normalises before becoming a [FrakResult.Failure]. */
    private suspend inline fun trackingCall(block: (merchantId: String) -> FrakResult<Unit>): FrakResult<Unit> =
        try {
            frakCall {
                requireTrackingEnabled()
                block(settings.merchantId ?: resolveConfig().merchantId)
            }
        } catch (known: FrakError) {
            FrakResult.Failure(known)
        }

    /** Resolves config first so a typo'd merchant id surfaces as [FrakError.MerchantResolutionFailed]. */
    private suspend fun fetchRewards(
        targetInteraction: String?,
        audience: RewardAudience?,
        forceRefresh: Boolean,
        products: List<ProductDetails>? = null,
    ) = rewards.fetch(
        merchantId = resolveConfig(forceRefresh = forceRefresh).merchantId,
        currency = settings.metadata.currency,
        targetInteraction = targetInteraction,
        audience = audience,
        forceRefresh = forceRefresh,
        products = products,
    )

    private suspend fun requireTrackingEnabled() {
        if (!consent.isEnabled()) throw FrakError.TrackingDisabled()
    }
}

/**
 * Caps the SDK's share of the shared IO pool. [id.frak.sdk.Frak] must hand the EventQueue this
 * exact instance rather than a second independent budget.
 */
@OptIn(ExperimentalCoroutinesApi::class)
internal fun defaultIoDispatcher(): CoroutineDispatcher = Dispatchers.IO.limitedParallelism(2)

/** Separate budget for [HttpClient], whose `perform()` blocks its thread for the whole request. */
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
