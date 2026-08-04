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
import kotlinx.coroutines.flow.StateFlow
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
        InteractionTracker(queue, http, logger, scope, currentClientId = { identity.anonymousId() })

    /** C3: [ConfigStore] owns the stream now — [fetch][ConfigStore] is its one publish point, foreground or background alike. This forwards it unchanged. */
    val configUpdates: StateFlow<FrakResolvedConfig?> = configStore.updates

    val environment: FrakEnvironment get() = settings.env

    /** Read by `Frak.preloadSharing`. Not on [FrakClient] itself: that would break every hand-written fake. */
    internal val preloadSharing: Boolean get() = settings.preloadSharing

    /**
     * 4.5: suspend, not a synchronous property — the first read used to mint a keypair on
     * whatever thread called it, main thread included. [identity]'s own eager generation
     * (started below, in `init`) means a caller here usually awaits an already-completed result.
     */
    suspend fun anonymousId(): String? = identity.anonymousId()

    /**
     * 4fp: `Boolean`, not `Unit` — false means the platform keystore refused to erase the key, the
     * old identity is still live, and the id did NOT rotate. Callers with a legal erasure
     * obligation must check this rather than assume success.
     */
    suspend fun resetAnonymousId(): Boolean {
        // Only purge on a confirmed erasure: a throwing keystore delete leaves the old identity
        // in place (AnonymousIdStore.reset), and purging anyway would discard queued events that
        // are about to be re-sent under an id that never actually rotated — permanent data loss
        // for a GDPR erasure that silently failed. Purge itself stays best-effort cleanup; the
        // guarantee is the flush loop dropping events whose captured id no longer matches current.
        val erased = identity.reset()
        if (erased) {
            scope.launch { tracker.purge() }
        }
        return erased
    }

    init {
        // 4.5: mints the keypair now, off whichever thread happens to call anonymousId() first.
        // Must run before anything below can reach identity.anonymousId()/signProof()/reset().
        identity.startEagerGeneration(scope)
        scope.launch {
            if (!settings.trackingEnabled) {
                // Events captured before the merchant turned tracking off must not be sent now.
                tracker.purge()
                return@launch
            }
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
     * this a referral link", and arrival tracking is fire-and-forget telemetry that must not
     * take a merchant's URL routing down with it. Mirrors the Swift twin, which discards
     * [track]'s `Result` for the same reason. Deliberately not [frakCall]-wrapped: that would
     * turn a future unexpected [Throwable] into a thrown [FrakError], the exact asymmetry this
     * guards against.
     */
    suspend fun handleReferralLink(url: String): Boolean {
        if (settings.deepLink == DeepLinkHandling.Disabled) return false
        val context = SharingLinkBuilder.parse(url) ?: return false

        // 3.2: reads configStore.currentConfig(query), not configStore.updates.value — a warm
        // start that never called resolve() (the dominant deep-link case: the process is launched
        // BY this very URL) publishes nothing to updates (C3's only publish point), so
        // updates.value would stay null and this guard would silently stop resolving a merchant
        // id it used to resolve. currentConfig(query) hydrates from disk on demand instead of only
        // reading whatever memory already holds. MerchantQuery.from can throw when FrakConfig has
        // neither merchantId nor packageId — this function must never throw, and a config that
        // can't identify a merchant at all can't be hydrated from disk either, so that case
        // degrades to null exactly like a genuine cache miss would.
        //
        // The whole hydrate is guarded, not just MerchantQuery.from: currentConfig is suspend and
        // reaches readCache -> SingleFlight, which can itself throw (e.g. a dead scope surfacing
        // as FrakError.Network) on paths that have nothing to do with a malformed FrakConfig. This
        // function is documented to never throw, and is deliberately not frakCall-wrapped (see the
        // doc above), so nothing here may let an unexpected FrakError or Throwable escape either —
        // except CancellationException, which must always propagate rather than be swallowed.
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

            // Minted once, for whichever arm takes it. The deep link needs it as much as the
            // store referrer does: an installed wallet lands on `/install` with no referrer to
            // read, so without the proof here the app-installed path is the only one that
            // reaches `ensure` unproven. Null when the keystore cannot sign, which both arms
            // already degrade past rather than block on.
            val proof = identity.signProof(ProofOp.Install, merchantId)

            // Attempted rather than gated on the probe: `isInstalled` can be false for reasons
            // unrelated to the app being absent, and `startActivity` already reports whether
            // anything took the intent. Mirrors iOS, where the probe is the weaker signal by a
            // wider margin — there it needs a merchant-side plist entry the SDK cannot inject.
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

    /**
     * [installProof] has no default (4.5): a suspend call cannot be a default-parameter
     * expression, so every caller — [installUrl] included, which has no second arm to share a
     * proof with — must mint and pass its own.
     */
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
     * Routed through [frakCall] (2.11): a bare `catch (known: FrakError)` here left an
     * unexpected `Throwable` — a genuine SDK bug inside [block], not a [FrakError] — to escape
     * uncaught instead of coming back as [FrakResult.Failure] the way every other public entry
     * point normalises it. `frakCall` itself always rethrows rather than returning, so the
     * catch here still does the [FrakResult] conversion; only the exception *normalisation* is
     * shared now.
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
     * [forceRefresh] forwards to the config resolve too (D6): a caller asking to bypass the
     * rewards cache almost certainly also wants a fresh merchant id/currency, not a stale one
     * served alongside freshly-fetched rewards.
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

    private fun requireTrackingEnabled() {
        if (!settings.trackingEnabled) throw FrakError.TrackingDisabled()
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
