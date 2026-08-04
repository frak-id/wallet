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
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.job
import kotlinx.coroutines.launch

/** The real [FrakClient]. Every public entry point lets only [FrakError]/`CancellationException` escape, see [frakCall]. */
internal class DefaultFrakClient(
    private val settings: FrakConfig,
    store: KeyValueStore,
    queue: EventQueue,
    private val identity: AnonymousIdStore,
    /** Must be the same instance [identity] holds: two [TrackingConsent] objects over the same store would memoise independently and drift. */
    private val consent: TrackingConsent,
    private val launcher: AppLauncher,
    private val logger: FrakLogger,
    private val ioDispatcher: CoroutineDispatcher = defaultIoDispatcher(),
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
            // Read per event inside the drain, so a withdrawal that lands mid-drain stops the
            // upload rather than only emptying a file the drain has already read.
            trackingAllowed = { consent.isEnabled() },
        )

    /** Forwards [ConfigStore]'s stream unchanged; [ConfigStore] owns publishing. */
    val configUpdates: StateFlow<FrakResolvedConfig?> = configStore.updates

    val environment: FrakEnvironment get() = settings.env

    /** Read by `Frak.preloadSharing`. Not on [FrakClient] itself: that would break every hand-written fake. */
    internal val preloadSharing: Boolean get() = settings.preloadSharing

    /** Suspend, not a synchronous property: the first read mints a keypair, which must not run on the caller's thread. [identity]'s eager generation in `init` usually means this awaits an already-completed result. */
    suspend fun anonymousId(): String? = identity.anonymousId()

    /** `Boolean`, not `Unit`: false means the platform keystore refused to erase the key and the id did not rotate. */
    suspend fun resetAnonymousId(): Boolean {
        // Only purge on confirmed erasure: purging after a failed keystore delete would discard
        // queued events for an id that never actually rotated.
        val erased = identity.reset()
        if (erased) {
            scope.launch { tracker.purge() }
        }
        return erased
    }

    /**
     * The runtime half of [FrakConfig.trackingEnabled]. `false` stops the SDK talking to the
     * backend for the rest of this install; the decision is persisted.
     *
     * Does not touch the keypair: withdrawal and erasure are two calls, so a merchant can
     * express a pause without burning attribution a later opt-in would want back.
     *
     * The queue is purged, since those events were captured under a decision that has just been
     * revoked.
     */
    suspend fun setTrackingEnabled(enabled: Boolean) {
        consent.setEnabled(enabled)
        if (!enabled) tracker.purge()
    }

    /** The effective state: [FrakConfig.trackingEnabled] AND the persisted decision. See [TrackingConsent]. */
    suspend fun isTrackingEnabled(): Boolean = consent.isEnabled()

    /**
     * Cancels every background coroutine this client owns (queue drain, config revalidation, the
     * eager identity mint) and waits for them to finish.
     *
     * Idempotent, with no restart contract: get a live client from [id.frak.sdk.Frak.initialize]
     * after [id.frak.sdk.Frak.shutdown]. "Dead" means no background work, not that every member
     * throws — `track` still returns [FrakResult.Success], since the enqueue is durable; only the
     * drain behind it is gone.
     *
     * Not a privacy control — [setTrackingEnabled] is.
     */
    suspend fun shutdown() {
        // cancelAndJoin, not cancel: a caller returning while a drain is still unwinding could
        // see it touch already-deleted state.
        scope.coroutineContext.job.cancelAndJoin()
    }

    init {
        // Mints the keypair now, off whichever thread calls anonymousId() first. Gated inside
        // AnonymousIdStore.current() on consent, so this is a no-op when consent is withdrawn.
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

    // resolveConfig/campaigns/bestReward do not wrap themselves in withContext(ioDispatcher):
    // that would move dispatch outside frakCall's error boundary.
    //
    // Deliberately not gated on consent, unlike every tracking entry point: this request carries
    // no user identifier, so refusing it with tracking off would cost the merchant their config,
    // campaign list and reward copy for no privacy gain.
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

    /**
     * Never throws, unlike every other public entry point: the return value only answers "was
     * this a referral link", and arrival tracking must not take a merchant's URL routing down
     * with it. Deliberately not [frakCall]-wrapped, which would turn an unexpected [Throwable]
     * into a thrown [FrakError].
     */
    suspend fun handleReferralLink(url: String): Boolean {
        if (settings.deepLink == DeepLinkHandling.Disabled) return false
        val context = SharingLinkBuilder.parse(url) ?: return false

        // Reads configStore.currentConfig(query), not configStore.updates.value: a cold start
        // launched by this very URL never calls resolve(), so updates.value stays null even
        // though a merchant id is resolvable. currentConfig hydrates from disk on demand.
        //
        // The whole hydrate is guarded, not just MerchantQuery.from: this function must never
        // throw, so any FrakError or Throwable degrades to null except CancellationException,
        // which always propagates.
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

            // Minted once, for whichever arm takes it: an installed wallet lands on `/install`
            // with no referrer, so this proof is the only route to `ensure`. Null when the
            // keystore cannot sign; both arms degrade past that.
            val proof = identity.signProof(ProofOp.Install, merchantId)

            // Attempted rather than gated on the probe: `isInstalled` can be false for reasons
            // unrelated to absence, and `startActivity` already reports whether anything took
            // the intent.
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

    suspend fun installUrl(): String? =
        frakCall {
            val (merchantId, anonymousId) = installIdentity() ?: return@frakCall null
            storeUrl(merchantId, anonymousId, identity.signProof(ProofOp.Install, merchantId))
        }

    suspend fun installPageUrl(
        returnScheme: String,
        sessionId: String,
    ): String? =
        frakCall {
            val (merchantId, anonymousId) = installIdentity() ?: return@frakCall null
            // Minted here, not when the sheet opens: most sessions never reach the install step,
            // and the backend's 30-day window runs from this timestamp.
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

    /** [installProof] has no default: a suspend call cannot be a default-parameter expression, so every caller must mint and pass its own. */
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

    /**
     * Only ever fails for a reason that won't resolve itself; connectivity is the queue's
     * problem.
     *
     * Routed through [frakCall] so an unexpected `Throwable` normalises to a [FrakError] before
     * this catch converts it to [FrakResult.Failure].
     */
    private suspend inline fun trackingCall(block: (merchantId: String) -> FrakResult<Unit>): FrakResult<Unit> =
        try {
            frakCall {
                requireTrackingEnabled()
                block(settings.merchantId ?: resolveConfig().merchantId)
            }
        } catch (known: FrakError) {
            FrakResult.Failure(known)
        }

    /**
     * Resolve first so a typo'd merchant id surfaces as [FrakError.MerchantResolutionFailed].
     *
     * [forceRefresh] forwards to the config resolve too: a caller bypassing the rewards cache
     * almost certainly wants a fresh merchant id/currency too.
     */
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

    /** Suspend: reads [TrackingConsent], whose first read is disk I/O. Called only from [trackingCall] — config/rewards stay ungated, see [resolveConfig]. */
    private suspend fun requireTrackingEnabled() {
        if (!consent.isEnabled()) throw FrakError.TrackingDisabled()
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
