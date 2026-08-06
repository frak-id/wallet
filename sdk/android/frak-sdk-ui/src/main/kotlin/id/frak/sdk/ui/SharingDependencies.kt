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

/** The merchant facts the sheet needs from a resolved config, already folded. */
internal class SharingMerchant(
    val merchantId: String,
    /** [FrakResolvedConfig.displayName]: the `sdkConfig` override when the backend sent one. */
    val displayName: String,
    val logoUrl: String?,
)

internal fun FrakResolvedConfig.toSharingMerchant(): SharingMerchant =
    SharingMerchant(merchantId = merchantId, displayName = displayName, logoUrl = displayLogoUrl)

/** Everything [SharingSheetState] needs from the SDK core, as one seam. */
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
 * The production implementation: every member re-reads `Frak.client` at call time, because
 * `Frak.initialize` may not have run when a sheet's state is built and the host may replace the
 * client via `Frak.shutdown()`.
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
