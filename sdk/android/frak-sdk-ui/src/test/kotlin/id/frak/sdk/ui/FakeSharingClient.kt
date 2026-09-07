package id.frak.sdk.ui

import id.frak.sdk.OpenAppResult
import id.frak.sdk.core.FrakEnvironment
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLanguage
import id.frak.sdk.core.FrakResult
import id.frak.sdk.core.ProductDetails
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.tracking.Interaction
import kotlinx.coroutines.CompletableDeferred

/** Stands in for the handful of [SharingDependencies] members the sheet actually calls. */
internal class FakeSharingClient : SharingDependencies {
    /** Null models `buildSharingLink`'s "nothing to share" case. */
    var link: String? = "https://acme.example/?fk=abc"

    var anonymousIdValue: String? = "a3f1c0de-0000-4000-8000-000000000000"

    var metadataNameValue: String? = null

    var metadataLangValue: FrakLanguage? = null

    override fun metadataName(): String? = metadataNameValue

    override fun metadataLang(): FrakLanguage? = metadataLangValue

    override suspend fun anonymousId(): String? = anonymousIdValue

    override fun environment(): FrakEnvironment = FrakEnvironment.Production

    var resolveFailure: FrakError? = null

    /** When set, [resolveConfig] suspends on this instead of returning. */
    var resolveGate: CompletableDeferred<Unit>? = null

    var trackCount = 0
        private set

    var openFrakAppCount = 0
        private set

    var bestReward: BestReward? = null

    var lastBestRewardProducts: List<ProductDetails>? = null
        private set

    private val resolved =
        SharingMerchant(
            merchantId = "b7c2e1a4-1111-4111-8111-111111111111",
            displayName = "Acme",
            logoUrl = null,
        )

    override suspend fun resolveConfig(): SharingMerchant {
        resolveGate?.await()
        resolveFailure?.let { throw it }
        return resolved
    }

    override suspend fun bestReward(
        targetInteraction: String?,
        products: List<ProductDetails>?,
    ): BestReward? {
        lastBestRewardProducts = products
        return bestReward
    }

    override suspend fun buildSharingLink(request: SharingRequest): String? = link

    /** Thrown by [track], [openFrakApp] and [installPageUrl] when set. */
    var clientFailure: FrakError? = null

    /** When set, [track] suspends on this instead of returning. */
    var trackGate: CompletableDeferred<Unit>? = null

    override suspend fun track(interaction: Interaction): FrakResult<Unit> {
        trackGate?.await()
        clientFailure?.let { throw it }
        trackCount++
        return FrakResult.Success(Unit)
    }

    /** The device's answer to the wallet probe; false is the un-merged-manifest case too. */
    var walletInstalled: Boolean = false

    /** Models `Frak.client` throwing once the merchant has shut the SDK down. */
    var probeFailure: FrakError? = null

    override fun isFrakAppInstalled(): Boolean {
        probeFailure?.let { throw it }
        return walletInstalled
    }

    /** Answered by [openFrakApp]; `Failed` models a deep link nothing on the device handles. */
    var openAppResult: OpenAppResult = OpenAppResult.OpenedApp

    override suspend fun openFrakApp(): OpenAppResult {
        clientFailure?.let { throw it }
        openFrakAppCount++
        return openAppResult
    }

    /** Null models "no identity or no merchant", the store-handoff fallback path. */
    var installPage: String? =
        "https://wallet.example/install?m=b7c2e1a4-1111-4111-8111-111111111111" +
            "&a=a3f1c0de-0000-4000-8000-000000000000#p=proof"

    var installPageUrlCount: Int = 0
        private set

    var installPageArgs: Pair<String, String>? = null
        private set

    override suspend fun installPageUrl(
        returnScheme: String,
        sessionId: String,
    ): String? {
        clientFailure?.let { throw it }
        installPageUrlCount++
        installPageArgs = returnScheme to sessionId
        return installPage
    }
}
