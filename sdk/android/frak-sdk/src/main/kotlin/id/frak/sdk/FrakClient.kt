package id.frak.sdk

import id.frak.sdk.config.FrakResolvedConfig
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakResult
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.rewards.Campaign
import id.frak.sdk.rewards.RewardAudience
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.tracking.Interaction
import kotlinx.coroutines.flow.StateFlow

/**
 * Everything the SDK can do, as one facade.
 *
 * Obtained from [Frak.client]. An interface rather than the implementation
 * class so merchant tests can substitute a fake without a mocking framework.
 *
 * Every `suspend` member throws only [FrakError] or `CancellationException` —
 * see [id.frak.sdk.core.frakCall] for the contract and why cancellation is
 * never wrapped.
 */
public interface FrakClient {
    /**
     * The last successfully resolved config, or null before the first resolve.
     *
     * A [StateFlow] so it is multicast: a single-consumer stream would starve
     * a second subscriber, and merchant apps have more than one. Conflated, so
     * a slow subscriber sees the newest config, not every intermediate one.
     */
    public val configUpdates: StateFlow<FrakResolvedConfig?>

    /**
     * Resolves the merchant this app belongs to, from a stale-while-revalidate
     * cache: fresh returns without touching the network, stale returns
     * immediately and refreshes in the background.
     *
     * The only call that can diagnose a bad merchant id — it genuinely 404s,
     * whereas the rewards endpoint answers a typo'd merchant id with
     * `200 {"rewards": []}`.
     *
     * @param forceRefresh bypass the cache and await the network. Failure
     *   backoff still applies, so a retry loop cannot become a request flood.
     * @throws FrakError.MerchantResolutionFailed when no merchant matches this
     *   app, or the config carries neither a merchant id nor a package id.
     * @throws FrakError.Network on transport failure with nothing cached.
     * @throws FrakError.Server on any other non-2xx with nothing cached.
     */
    public suspend fun resolveConfig(forceRefresh: Boolean = false): FrakResolvedConfig

    /**
     * Active campaigns for this merchant, highest priority first.
     *
     * Non-null and possibly empty; an empty list is a normal "between
     * campaigns" state, not distinguishable here from an unknown merchant —
     * use [resolveConfig] for that.
     *
     * @throws FrakError as [resolveConfig].
     */
    public suspend fun campaigns(forceRefresh: Boolean = false): List<Campaign>

    /**
     * The single reward worth advertising, formatted by the server.
     *
     * Null when there is nothing worth showing (no campaign matched, or the
     * merchant has none) — an expected outcome, not a failure.
     *
     * Takes no currency parameter: currency comes from
     * [id.frak.sdk.core.FrakMetadata.currency], never the caller and never
     * the device locale, so every surface advertises the same amount.
     * [BestReward.formatted] is display-ready and must be rendered as-is.
     *
     * @param targetInteraction narrows to campaigns with this trigger, e.g.
     *   `purchase`. Null considers every campaign.
     * @throws FrakError.Network on transport failure.
     * @throws FrakError.Server on a non-2xx.
     */
    public suspend fun bestReward(
        targetInteraction: String? = null,
        audience: RewardAudience? = null,
        forceRefresh: Boolean = false,
    ): BestReward?

    /**
     * This installation's anonymous id, or null when [id.frak.sdk.core.FrakConfig.trackingEnabled]
     * is false or the device refused to produce key material.
     *
     * Derived from a P-256 keypair held in the platform keystore, so it is
     * self-authenticating and dies with the app. Scoped to one installation:
     * a reinstall is a new user, exactly as clearing site data is on the web.
     *
     * The first read touches the keystore, and therefore storage; later reads
     * do not. [Frak.initialize] warms it in the background, so a read from the
     * main thread is almost always already resolved.
     */
    public val anonymousId: String?

    /**
     * Destroys the keypair, so the next read of [anonymousId] mints a new
     * identity. For GDPR erasure requests.
     *
     * Everything already attributed to the old id stays with it — this severs
     * the device from that id, it does not delete history.
     */
    public fun resetAnonymousId()

    /**
     * Builds a share link for [request]: the merchant's URL, carrying who
     * shared it and the attribution parameters that follow from that.
     *
     * Null when there is no identity to build from — tracking off, or a device
     * that refused to produce key material — and null rather than throwing
     * because "nothing to share with" is an expected state, not a failure.
     *
     * Issues no network request of its own. It does read the resolved config,
     * for the merchant id when only a package id was configured and for the
     * merchant's attribution defaults, which is a cache hit in every case but
     * the first; a cold cache that cannot be filled yields null rather than an
     * unattributed link. Offline sharing therefore works: the link is correct,
     * only the reward pitch is missing.
     */
    public suspend fun buildSharingLink(request: SharingRequest): String?

    /**
     * Records an [Interaction] and tries to send it.
     *
     * Succeeds once the event is durable, not once it is delivered. The
     * distinction matters: an event recorded only on a successful response is
     * lost to every tunnel, every airplane-mode moment, and every process kill
     * — and Android will kill a host app while the OS share sheet is
     * foregrounded, which is exactly when a `sharing` event is in flight.
     * Queued events are sent oldest-first on the next opportunity.
     *
     * Returns [FrakResult.Failure] only for reasons that will not resolve
     * themselves: tracking disabled, or no merchant to attribute to.
     */
    public suspend fun track(interaction: Interaction): FrakResult<Unit>

    /**
     * Records a purchase, so a campaign that pays out on one can.
     *
     * Same enqueue-then-send contract as [track] — call it as soon as the order
     * is confirmed rather than waiting for a screen that the user may never
     * reach.
     *
     * @param customerId the merchant's own customer identifier.
     * @param orderId the merchant's own order identifier.
     * @param token the checkout token the backend reconciles the purchase with.
     */
    public suspend fun trackPurchase(
        customerId: String,
        orderId: String,
        token: String,
    ): FrakResult<Unit>

    /**
     * Handles an inbound link: decodes its referral context, applies the
     * self-referral guard, and tracks the arrival.
     *
     * Called for you under [id.frak.sdk.core.DeepLinkHandling.Automatic]. Under
     * `Manual`, call it from your router.
     *
     * @return whether the link carried a Frak referral context. **This is not a
     *   "stop routing" signal.** A share link is the merchant's own product URL
     *   with an `fCtx` appended, so the merchant must still navigate to it —
     *   treating true as consumed would break every link the SDK is supposed to
     *   make work.
     */
    public suspend fun handleReferralLink(url: String): Boolean

    /** Whether the Frak wallet app for the configured environment is installed. */
    public fun isFrakAppInstalled(): Boolean

    /**
     * Links this installation's anonymous id to the user's Frak wallet, opening
     * the app when it is there and the Play Store listing when it is not.
     *
     * This is the install step of the sharing flow, and the SDK owns it end to
     * end. A merchant should not call it from a `SharingResult.InstallStarted`
     * callback — that result reports the step the SDK already performed.
     *
     * The store path carries a Play install referrer, so the link survives the
     * round-trip and the wallet completes it on first launch.
     */
    public suspend fun openFrakApp(): OpenAppResult

    /**
     * The Play Store URL that links this installation, for a merchant
     * rendering their own install call to action. Null when there is no
     * identity or no merchant to link.
     */
    public suspend fun installUrl(): String?
}

/** What [FrakClient.openFrakApp] managed to do. */
public enum class OpenAppResult {
    /** The wallet app was already installed and took the deep link. */
    OpenedApp,

    /** The wallet app was absent; the store listing was opened instead. */
    OpenedStore,

    /**
     * Nothing opened — no identity to link, no merchant to link it to, or no
     * activity willing to handle either URL.
     */
    Failed,
}
