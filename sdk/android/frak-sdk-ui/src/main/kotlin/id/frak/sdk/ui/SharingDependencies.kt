package id.frak.sdk.ui

import id.frak.sdk.Frak
import id.frak.sdk.OpenAppResult
import id.frak.sdk.config.FrakResolvedConfig
import id.frak.sdk.core.FrakEnvironment
import id.frak.sdk.core.FrakResult
import id.frak.sdk.core.ProductDetails
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.rewards.RewardRequest
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.tracking.Interaction

/**
 * The three merchant facts the sheet actually needs from a resolved config.
 *
 * The sheet used to take the whole [FrakResolvedConfig] — a fifty-one-property tree — and read four
 * properties out of it over eight sites in two files, folding `sdkConfig?.name ?: name` itself at two
 * of them. This carries the three values it actually needs, already folded.
 *
 * Two consequences, both wanted. The tree's constructors can be `internal` (it is a read model a
 * merchant is handed, never builds) because nothing in this module constructs one any more, tests
 * included. And this module now names [FrakResolvedConfig] in exactly one place: the projection
 * below.
 *
 * The cost is that [toSharingMerchant] itself is unreachable from this module's tests, since they
 * cannot build a tree to project. The fold it delegates to is pinned in `:frak-sdk`.
 */
internal class SharingMerchant(
    val merchantId: String,
    /** [FrakResolvedConfig.displayName]: the `sdkConfig` override when the backend sent one. */
    val displayName: String,
    /** [FrakResolvedConfig.displayLogoUrl]. */
    val logoUrl: String?,
)

internal fun FrakResolvedConfig.toSharingMerchant(): SharingMerchant =
    SharingMerchant(merchantId = merchantId, displayName = displayName, logoUrl = displayLogoUrl)

/**
 * Everything [SharingSheetState] needs from the SDK core, as one seam.
 *
 * Was eight individually injected suspend lambdas with eight default values, which meant every
 * construction site — production and test — restated the whole list. One interface is the same
 * seam with one line.
 *
 * Mixed suspend/non-suspend members on purpose: [environment] is a plain getter on the client and
 * making it suspend would only oblige every implementation to lie about it.
 */
internal interface SharingDependencies {
    suspend fun buildSharingLink(request: SharingRequest): String?

    suspend fun anonymousId(): String?

    fun environment(): FrakEnvironment

    /**
     * Throws [id.frak.sdk.core.FrakError] exactly as `ConfigApi.resolve` does; the sheet's tier-3
     * fallback depends on that.
     */
    suspend fun resolveConfig(): SharingMerchant

    suspend fun bestReward(
        targetInteraction: String?,
        products: List<ProductDetails>?,
    ): BestReward?

    suspend fun track(interaction: Interaction): FrakResult<Unit>

    suspend fun installPageUrl(
        returnScheme: String,
        sessionId: String,
    ): String?

    suspend fun openFrakApp(): OpenAppResult
}

/**
 * The production implementation: every member re-reads `Frak.client` at call time.
 *
 * An `object` with per-member reads, deliberately, rather than a class holding a `FrakClient`
 * captured at construction. `Frak.initialize` may not have run when a sheet's state is built, and
 * `Frak.client`'s getter throws [id.frak.sdk.core.FrakError.NotInitialized] until it has — so a
 * captured client would either throw at construction or pin a client the host has since replaced
 * via `Frak.shutdown()`. The lazy reads this replaced had the same property; keep it.
 */
internal object FrakClientDependencies : SharingDependencies {
    override suspend fun buildSharingLink(request: SharingRequest): String? = Frak.client.sharing.buildLink(request)

    override suspend fun anonymousId(): String? = Frak.client.anonymousId()

    override fun environment(): FrakEnvironment = Frak.client.environment

    override suspend fun resolveConfig(): SharingMerchant =
        Frak.client.config
            .resolve()
            .toSharingMerchant()

    override suspend fun bestReward(
        targetInteraction: String?,
        products: List<ProductDetails>?,
    ): BestReward? =
        Frak.client.rewards.best(
            RewardRequest {
                this.targetInteraction = targetInteraction
                // `RewardRequest.products` is non-null; the seam's parameter is nullable because the
                // sheet distinguishes "no products in this request" from "an empty scope".
                this.products = products.orEmpty()
            },
        )

    override suspend fun track(interaction: Interaction): FrakResult<Unit> = Frak.client.tracking.track(interaction)

    override suspend fun installPageUrl(
        returnScheme: String,
        sessionId: String,
    ): String? = Frak.client.appLink.installPageUrl(returnScheme, sessionId)

    override suspend fun openFrakApp(): OpenAppResult = Frak.client.appLink.openFrakApp()
}
