package id.frak.sdk.ui

import id.frak.sdk.Frak
import id.frak.sdk.OpenAppResult
import id.frak.sdk.config.FrakResolvedConfig
import id.frak.sdk.core.FrakEnvironment
import id.frak.sdk.core.FrakResult
import id.frak.sdk.core.ProductDetails
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.tracking.Interaction

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

    suspend fun resolveConfig(): FrakResolvedConfig

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

    override suspend fun resolveConfig(): FrakResolvedConfig = Frak.client.config.resolve()

    override suspend fun bestReward(
        targetInteraction: String?,
        products: List<ProductDetails>?,
    ): BestReward? = Frak.client.rewards.best(targetInteraction = targetInteraction, products = products)

    override suspend fun track(interaction: Interaction): FrakResult<Unit> = Frak.client.tracking.track(interaction)

    override suspend fun installPageUrl(
        returnScheme: String,
        sessionId: String,
    ): String? = Frak.client.appLink.installPageUrl(returnScheme, sessionId)

    override suspend fun openFrakApp(): OpenAppResult = Frak.client.appLink.openFrakApp()
}
