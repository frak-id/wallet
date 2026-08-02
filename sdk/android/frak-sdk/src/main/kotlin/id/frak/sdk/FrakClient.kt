package id.frak.sdk

import id.frak.sdk.config.FrakResolvedConfig
import id.frak.sdk.core.FrakEnvironment
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakResult
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.rewards.Campaign
import id.frak.sdk.rewards.RewardAudience
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.tracking.Interaction
import kotlinx.coroutines.flow.StateFlow

/** Everything the SDK can do, as one facade. Obtained from [Frak.client]. */
public interface FrakClient {
    /** Latest resolved config, or null before the first resolve. Conflated [StateFlow]. */
    public val configUpdates: StateFlow<FrakResolvedConfig?>

    /** Stale-while-revalidate; only call that reliably 404s on a bad merchant id. */
    public suspend fun resolveConfig(forceRefresh: Boolean = false): FrakResolvedConfig

    /** Active campaigns for this merchant, highest priority first. */
    public suspend fun campaigns(forceRefresh: Boolean = false): List<Campaign>

    /** Reward worth advertising, formatted server-side; null when nothing matches. */
    public suspend fun bestReward(
        targetInteraction: String? = null,
        audience: RewardAudience? = null,
        forceRefresh: Boolean = false,
    ): BestReward?

    /** The stage this client talks to. Merchants never set it directly, see [id.frak.sdk.core.FrakConfig.env]. */
    public val environment: FrakEnvironment

    /** Anonymous id, or null when tracking disabled or device refused key material. */
    public val anonymousId: String?

    /** Destroys the keypair so [anonymousId] mints a new identity. For GDPR erasure; does not delete history. */
    public fun resetAnonymousId()

    /** Builds a share link for [request]; null when there's no identity to build from. */
    public suspend fun buildSharingLink(request: SharingRequest): String?

    /** Records an [Interaction]; succeeds once durable, not once delivered (queued, oldest-first). */
    public suspend fun track(interaction: Interaction): FrakResult<Unit>

    /** Records a purchase; same enqueue-then-send contract as [track]. */
    public suspend fun trackPurchase(
        customerId: String,
        orderId: String,
        token: String,
    ): FrakResult<Unit>

    /** Decodes referral context, guards self-referral, tracks arrival. Not a "stop routing" signal. */
    public suspend fun handleReferralLink(url: String): Boolean

    public fun isFrakAppInstalled(): Boolean

    /** Opens the wallet app if installed, else the Play Store listing with an install referrer. */
    public suspend fun openFrakApp(): OpenAppResult

    public suspend fun installUrl(): String?
}

public enum class OpenAppResult {
    OpenedApp,
    OpenedStore,

    Failed,
}
