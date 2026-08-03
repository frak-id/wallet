package id.frak.sdk.ui

import id.frak.sdk.FrakClient
import id.frak.sdk.OpenAppResult
import id.frak.sdk.config.FrakResolvedConfig
import id.frak.sdk.core.FrakEnvironment
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakResult
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.rewards.Campaign
import id.frak.sdk.rewards.RewardAudience
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.tracking.Interaction
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Hand-written [FrakClient] fake for the sheet's tests (no mocking framework dependency). */
internal class FakeFrakClient : FrakClient {
    /** Null models `buildSharingLink`'s "nothing to share" case. */
    var link: String? = "https://acme.example/?fk=abc"

    override var anonymousId: String? = "a3f1c0de-0000-4000-8000-000000000000"

    /** Thrown by [resolveConfig] when set. */
    var resolveFailure: FrakError? = null

    /** When set, [resolveConfig] suspends on this instead of returning — models a slow (not failed) resolve. */
    var resolveGate: CompletableDeferred<Unit>? = null

    var trackCount = 0
        private set

    var openFrakAppCount = 0
        private set

    private val resolved =
        FrakResolvedConfig(
            merchantId = "b7c2e1a4-1111-4111-8111-111111111111",
            name = "Acme",
            domain = "acme.example",
        )

    override val configUpdates: StateFlow<FrakResolvedConfig?> = MutableStateFlow(resolved).asStateFlow()

    override suspend fun resolveConfig(forceRefresh: Boolean): FrakResolvedConfig {
        resolveGate?.await()
        resolveFailure?.let { throw it }
        return resolved
    }

    override suspend fun campaigns(forceRefresh: Boolean): List<Campaign> = emptyList()

    override suspend fun bestReward(
        targetInteraction: String?,
        audience: RewardAudience?,
        forceRefresh: Boolean,
    ): BestReward? = null

    override fun resetAnonymousId() = Unit

    override suspend fun buildSharingLink(request: SharingRequest): String? = link

    override suspend fun track(interaction: Interaction): FrakResult<Unit> {
        trackCount++
        return FrakResult.Success(Unit)
    }

    override suspend fun trackPurchase(
        customerId: String,
        orderId: String,
        token: String,
    ): FrakResult<Unit> = FrakResult.Success(Unit)

    override suspend fun handleReferralLink(url: String): Boolean = false

    override fun isFrakAppInstalled(): Boolean = false

    override suspend fun openFrakApp(): OpenAppResult {
        openFrakAppCount++
        return OpenAppResult.OpenedApp
    }

    override suspend fun installUrl(): String? = null

    /** Null models "no identity or no merchant", which is the store-handoff fallback path. */
    var installPage: String? =
        "https://wallet.example/install?m=b7c2e1a4-1111-4111-8111-111111111111" +
            "&a=a3f1c0de-0000-4000-8000-000000000000#p=proof"

    var installPageUrlCount: Int = 0
        private set

    /** What the sheet asked for, so a test can prove the channel params reached the client. */
    var installPageArgs: Pair<String, String>? = null
        private set

    override suspend fun installPageUrl(
        returnScheme: String,
        sessionId: String,
    ): String? {
        installPageUrlCount++
        installPageArgs = returnScheme to sessionId
        return installPage
    }

    override val environment: FrakEnvironment = FrakEnvironment.Production
}
