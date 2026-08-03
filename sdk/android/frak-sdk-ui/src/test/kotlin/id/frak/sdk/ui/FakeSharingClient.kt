package id.frak.sdk.ui

import id.frak.sdk.OpenAppResult
import id.frak.sdk.config.FrakResolvedConfig
import id.frak.sdk.core.FrakEnvironment
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakResult
import id.frak.sdk.core.ProductDetails
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.tracking.Interaction
import kotlinx.coroutines.CompletableDeferred

/**
 * Backs [SharingSheetState]'s injected functions for tests. Not a [id.frak.sdk.FrakClient]
 * fake: `FrakClient` carries no substitutable abstraction (02-sdk-design.md) — this only
 * stands in for the handful of members the sheet actually calls.
 */
internal class FakeSharingClient {
    /** Null models `buildSharingLink`'s "nothing to share" case. */
    var link: String? = "https://acme.example/?fk=abc"

    var anonymousId: String? = "a3f1c0de-0000-4000-8000-000000000000"

    val environment: FrakEnvironment = FrakEnvironment.Production

    /** Thrown by [resolveConfig] when set. */
    var resolveFailure: FrakError? = null

    /** When set, [resolveConfig] suspends on this instead of returning — models a slow (not failed) resolve. */
    var resolveGate: CompletableDeferred<Unit>? = null

    var trackCount = 0
        private set

    var openFrakAppCount = 0
        private set

    /** `null` best reward by default; set to observe the sheet's seeded-reward call. */
    var bestReward: BestReward? = null

    /** The `products` argument the sheet last passed to [bestReward], for assertions. */
    var lastBestRewardProducts: List<ProductDetails>? = null
        private set

    private val resolved =
        FrakResolvedConfig(
            merchantId = "b7c2e1a4-1111-4111-8111-111111111111",
            name = "Acme",
            domain = "acme.example",
        )

    suspend fun resolveConfig(): FrakResolvedConfig {
        resolveGate?.await()
        resolveFailure?.let { throw it }
        return resolved
    }

    suspend fun bestReward(
        targetInteraction: String?,
        products: List<ProductDetails>?,
    ): BestReward? {
        lastBestRewardProducts = products
        return bestReward
    }

    suspend fun buildSharingLink(request: SharingRequest): String? = link

    suspend fun track(interaction: Interaction): FrakResult<Unit> {
        trackCount++
        return FrakResult.Success(Unit)
    }

    suspend fun openFrakApp(): OpenAppResult {
        openFrakAppCount++
        return OpenAppResult.OpenedApp
    }

    /** Null models "no identity or no merchant", which is the store-handoff fallback path. */
    var installPage: String? =
        "https://wallet.example/install?m=b7c2e1a4-1111-4111-8111-111111111111" +
            "&a=a3f1c0de-0000-4000-8000-000000000000#p=proof"

    var installPageUrlCount: Int = 0
        private set

    /** What the sheet asked for, so a test can prove the channel params reached the client. */
    var installPageArgs: Pair<String, String>? = null
        private set

    suspend fun installPageUrl(
        returnScheme: String,
        sessionId: String,
    ): String? {
        installPageUrlCount++
        installPageArgs = returnScheme to sessionId
        return installPage
    }
}
