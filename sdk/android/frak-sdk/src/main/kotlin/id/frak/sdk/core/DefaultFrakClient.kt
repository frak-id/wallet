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

/**
 * The real [FrakClient].
 *
 * Wiring, plus the one invariant that cannot live in any single component:
 * every public entry point lets only [FrakError] and `CancellationException`
 * escape. See [frakCall].
 */
internal class DefaultFrakClient(
    private val config: FrakConfig,
    store: KeyValueStore,
    queue: EventQueue,
    private val identity: AnonymousIdStore,
    private val launcher: AppLauncher,
    private val logger: FrakLogger,
    private val ioDispatcher: CoroutineDispatcher = defaultIoDispatcher(),
    // Overridable so tests can substitute a fake transport underneath; production
    // always takes the default.
    http: HttpClient = HttpClient(baseUrl = config.env.backend, ioDispatcher = ioDispatcher),
) : FrakClient {
    /**
     * The SDK's own scope, so background work outlives the caller that started
     * it. `SupervisorJob` isolates a failed revalidation from the rest of the
     * scope; the exception handler stops anything from escaping to the
     * process-wide default handler (never crash the host).
     */
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
    private val tracker = InteractionTracker(queue, http, logger)

    private val configState = MutableStateFlow<FrakResolvedConfig?>(null)

    override val configUpdates: StateFlow<FrakResolvedConfig?> = configState.asStateFlow()

    override val anonymousId: String?
        get() = identity.anonymousId()

    override fun resetAnonymousId() {
        identity.reset()
        // Purged, not left behind: an event captured under a dead id would
        // re-link the identity the user just asked to be forgotten.
        scope.launch { tracker.purge() }
    }

    init {
        // Reading the keystore is storage I/O, and `anonymousId` is a property a
        // merchant will read from the main thread. Resolving it here means that
        // read is a field access by the time anything can reach it.
        scope.launch {
            identity.anonymousId()
            // Anything a previous session queued and could not send. Nothing
            // else triggers a drain: the SDK holds no connectivity callback,
            // since that needs ACCESS_NETWORK_STATE, a permission a library
            // must not force onto its host.
            tracker.flush()
        }
    }

    // Disk and decode work is kept off the caller's dispatcher (typically
    // Dispatchers.Main) narrowly, at the point that actually does it: the
    // withContext(ioDispatcher) inside ConfigStore's readPersisted/
    // writePersisted, and the SDK's own scope (also on ioDispatcher) that
    // SingleFlight runs fetch/decode on. Wrapping resolveConfig, campaigns
    // and bestReward below themselves in withContext(ioDispatcher) was
    // tried and reverted: it starved a 2-slot pool shared with a blocking
    // HttpClient.perform() — a pure cache hit that touches no I/O at all
    // would queue behind two hung requests — and it moved dispatch outside
    // frakCall's error boundary, letting whatever withContext itself throws
    // (e.g. a RejectedExecutionException from a shut-down dispatcher) escape
    // unwrapped, violating the invariant every entry point promises.
    override suspend fun resolveConfig(forceRefresh: Boolean): FrakResolvedConfig =
        frakCall {
            requireTrackingEnabled()
            val resolved = configStore.resolve(MerchantQuery.from(config), forceRefresh)
            configState.value = resolved
            resolved
        }

    override suspend fun campaigns(forceRefresh: Boolean): List<Campaign> =
        frakCall {
            fetchRewards(null, null, forceRefresh).campaigns
        }

    override suspend fun bestReward(
        targetInteraction: String?,
        audience: RewardAudience?,
        forceRefresh: Boolean,
    ): BestReward? =
        frakCall {
            fetchRewards(targetInteraction, audience, forceRefresh).best
        }

    override suspend fun buildSharingLink(request: SharingRequest): String? =
        frakCall {
            val clientId = identity.anonymousId() ?: return@frakCall null
            // Tolerated rather than propagated: this method is specified as
            // nullable and never-throwing, and a resolve failure means the same
            // thing to a caller as no identity — there is no link to hand back.
            val resolved = runCatching { resolveConfig() }.getOrNull()
            val merchantId = config.merchantId ?: resolved?.merchantId ?: return@frakCall null
            val product = request.products.firstOrNull()
            val baseUrl =
                request.link
                    ?: product?.link
                    ?: resolved?.sdkConfig?.homepageLink
                    ?: config.metadata.homepageLink
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

    override suspend fun track(interaction: Interaction): FrakResult<Unit> =
        trackingCall { merchantId ->
            tracker.track(merchantId, identity.anonymousId(), interaction)
            FrakResult.Success(Unit)
        }

    override suspend fun trackPurchase(
        customerId: String,
        orderId: String,
        token: String,
    ): FrakResult<Unit> =
        trackingCall { merchantId ->
            tracker.trackPurchase(merchantId, identity.anonymousId(), customerId, orderId, token)
            FrakResult.Success(Unit)
        }

    /**
     * Fire-and-forget [handleReferralLink], on the SDK's own scope.
     *
     * The automatic deep-link observer is a lifecycle callback and cannot
     * suspend; handing it a scope of its own would leak one per link and put
     * the work outside the supervisor that stops a failure reaching the host's
     * crash handler.
     */
    internal fun handleReferralLinkInBackground(url: String) {
        scope.launch { handleReferralLink(url) }
    }

    override suspend fun handleReferralLink(url: String): Boolean =
        frakCall {
            if (config.deepLink == DeepLinkHandling.Disabled) return@frakCall false
            val context = SharingLinkBuilder.parse(url) ?: return@frakCall false

            if (ReferralArrival.isSelfReferral(context, identity.anonymousId())) {
                logger.info("Ignoring a referral link this device produced.")
                return@frakCall true
            }

            track(ReferralArrival.arrivalFrom(context))
            true
        }

    override fun isFrakAppInstalled(): Boolean = launcher.isInstalled(config.env.walletPackageId)

    override suspend fun openFrakApp(): OpenAppResult =
        frakCall {
            val link = installIdentity() ?: return@frakCall OpenAppResult.Failed
            val (merchantId, anonymousId) = link

            // Attempted rather than gated on the probe: `isInstalled` can be
            // false for reasons that have nothing to do with the app being
            // absent, and startActivity is not gated by it. Trusting the probe
            // would turn a visibility quirk into a dead feature.
            if (isFrakAppInstalled() &&
                launcher.open(InstallLinks.deepLink(config.env.walletScheme, merchantId, anonymousId))
            ) {
                return@frakCall OpenAppResult.OpenedApp
            }

            val store = storeUrl(merchantId, anonymousId)
            if (launcher.open(store)) OpenAppResult.OpenedStore else OpenAppResult.Failed
        }

    override suspend fun installUrl(): String? =
        frakCall {
            val (merchantId, anonymousId) = installIdentity() ?: return@frakCall null
            storeUrl(merchantId, anonymousId)
        }

    /** The merchant/anonymous-id pair an install link needs, or null when either is missing. */
    private suspend fun installIdentity(): Pair<String, String>? {
        val anonymousId = identity.anonymousId() ?: return null
        val merchantId =
            config.merchantId ?: runCatching { resolveConfig() }.getOrNull()?.merchantId ?: return null
        return merchantId to anonymousId
    }

    private fun storeUrl(
        merchantId: String,
        anonymousId: String,
    ): String =
        InstallLinks.playStore(
            packageId = config.env.walletPackageId,
            merchantId = merchantId,
            anonymousId = anonymousId,
            // Additive: a wallet build that predates proofs ignores the key, and
            // a device that cannot sign simply omits it.
            installProof = identity.signProof(ProofOp.Install, merchantId),
        )

    /**
     * Resolves the merchant an event belongs to, then runs [block].
     *
     * Failure here is only ever a reason that will not resolve itself —
     * tracking off, or no merchant to attribute to. Everything transient is the
     * queue's problem, not the caller's, which is why nothing about
     * connectivity can reach this return value.
     */
    private suspend inline fun trackingCall(block: (merchantId: String) -> FrakResult<Unit>): FrakResult<Unit> =
        try {
            requireTrackingEnabled()
            block(config.merchantId ?: resolveConfig().merchantId)
        } catch (known: FrakError) {
            FrakResult.Failure(known)
        }

    /**
     * Resolves the merchant, then reads its rewards. Sequencing resolve first
     * means a typo'd merchant id surfaces as
     * [FrakError.MerchantResolutionFailed] rather than a permanently empty
     * reward list; it is nearly always a cache hit.
     */
    private suspend fun fetchRewards(
        targetInteraction: String?,
        audience: RewardAudience?,
        forceRefresh: Boolean,
    ) = rewards.fetch(
        merchantId = resolveConfig(forceRefresh = false).merchantId,
        currency = config.metadata.currency,
        targetInteraction = targetInteraction,
        audience = audience,
        forceRefresh = forceRefresh,
    )

    // When tracking is off, no id is generated and no network is issued —
    // including for resolveConfig, which is itself a request on the user's
    // behalf carrying their IP.
    private fun requireTrackingEnabled() {
        if (!config.trackingEnabled) throw FrakError.TrackingDisabled
    }
}

/**
 * Caps the SDK's share of the shared IO pool. `Dispatchers.IO` defaults to 64
 * threads shared with the host app; without a cap, a burst of SDK work could
 * starve the merchant's own disk I/O.
 */
@OptIn(ExperimentalCoroutinesApi::class)
private fun defaultIoDispatcher(): CoroutineDispatcher = Dispatchers.IO.limitedParallelism(2)

/**
 * Runs [block] and normalises whatever escapes, so only [FrakError] leaves
 * the SDK.
 *
 * The `CancellationException` arm must come first and must rethrow untouched:
 * a catch-all that swallows it breaks structured concurrency — the parent
 * never learns the child cancelled, `withTimeout` silently stops working, and
 * scope teardown leaks.
 */
internal inline fun <T> frakCall(block: () -> T): T =
    try {
        block()
    } catch (cancelled: CancellationException) {
        throw cancelled
    } catch (known: FrakError) {
        throw known
    } catch (unexpected: Throwable) {
        // Anything reaching here is a bug rather than a condition. Wrapped
        // rather than propagated so a merchant's `catch (e: FrakError)` cannot
        // be bypassed by something we failed to anticipate.
        throw FrakError.Decoding("unexpected failure: ${unexpected.message}", unexpected)
    }
