package id.frak.sdk.ui

import id.frak.sdk.OpenAppResult
import id.frak.sdk.core.FrakEnvironment
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakResult
import id.frak.sdk.core.ProductDetails
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.tracking.Interaction
import kotlinx.coroutines.CompletableDeferred

/**
 * Backs [SharingSheetState]'s [SharingDependencies] seam for tests. Not a [id.frak.sdk.FrakClient]
 * fake — stands in only for the handful of members the sheet actually calls.
 *
 * Implements the interface directly rather than being adapted into it, so `newState` passes one
 * argument and every knob below stays where the tests already reach for it.
 */
internal class FakeSharingClient : SharingDependencies {
    /** Null models `buildSharingLink`'s "nothing to share" case. */
    var link: String? = "https://acme.example/?fk=abc"

    var anonymousIdValue: String? = "a3f1c0de-0000-4000-8000-000000000000"

    override suspend fun anonymousId(): String? = anonymousIdValue

    override fun environment(): FrakEnvironment = FrakEnvironment.Production

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

    /**
     * What `ConfigApi.resolve().toSharingMerchant()` would produce. Built directly rather than
     * decoded: the config tree's constructors are `internal` to `:frak-sdk`, and KGP wires friend
     * access from a module's `test` compilation to its own `main`, not to another module's — so
     * there is no tree to project here. The fold from tree to these three values is pinned in
     * `:frak-sdk`'s own `FrakResolvedConfigTest`, which does have that access.
     */
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

    /**
     * Thrown by [track], [openFrakApp] and [installPageUrl] when set.
     *
     * Models what `Frak.client`'s getter does once `Frak.shutdown()` has run, which a host app may
     * legitimately do while a sheet is open. These calls live inside `scope.launch { }` with no
     * exception handler between them and the merchant's process.
     */
    var clientFailure: FrakError? = null

    /**
     * When set, [track] suspends on this instead of returning — models an attribution still in
     * flight, which is the window `abandon()` has to defer to rather than report over.
     */
    var trackGate: CompletableDeferred<Unit>? = null

    override suspend fun track(interaction: Interaction): FrakResult<Unit> {
        trackGate?.await()
        clientFailure?.let { throw it }
        trackCount++
        return FrakResult.Success(Unit)
    }

    override suspend fun openFrakApp(): OpenAppResult {
        clientFailure?.let { throw it }
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
