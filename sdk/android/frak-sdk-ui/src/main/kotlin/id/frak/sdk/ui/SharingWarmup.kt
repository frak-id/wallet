package id.frak.sdk.ui

import id.frak.sdk.Frak
import id.frak.sdk.core.FrakError

/**
 * Warms the data the sheet needs before it can build a URL at all, then the page itself.
 *
 * The web view is only half of the tap-to-paint cost; the other half is `SharingSheetState.build`,
 * which cannot start the page load until `buildSharingLink`, `anonymousId` and `resolveConfig`
 * have all answered. Device traces put that stretch at 713ms on the first open of a process and
 * ~276ms after, i.e. more of the budget than the page load it precedes.
 *
 * Both reads are memoised inside the SDK, so this is purely about paying for them while the user
 * is still looking at the merchant's screen. Gated on the same
 * [id.frak.sdk.core.FrakConfig.preloadSharing] flag as the view pool: doing work ahead of an
 * intent the user has not expressed yet is exactly what that flag opts into.
 *
 * Resolving the config is also what unlocks warming the *real* page rather than a neutral one —
 * the merchantId is the thing the page needs before it can boot its queries, and it does not
 * exist any earlier. That is why the pool is warmed from here rather than from its own
 * construction.
 *
 * The reward is deliberately not warmed. `RewardRepository`'s cache is keyed on the encoded
 * product list, so a warm-up without the request's products mints a different key and buys the
 * sheet nothing.
 *
 * Started by [FrakSharing.warm], not by construction — see that method for why the two are
 * separate. Was a `@Composable` whose `LaunchedEffect` tied warming to a *screen*; it is a plain
 * suspend function now so a merchant on XML or Java can reach it too.
 */
internal suspend fun warmSharingData(
    pool: SharingWebViewPool,
    packageId: String,
) {
    if (!Frak.isInitialized) return
    if (!Frak.preloadSharing) return

    val trace = SharingTrace()
    val client = Frak.client
    val walletOrigin = client.environment.wallet

    // The keystore mint is already eager at initialize; awaiting it here only guarantees the
    // sheet's own read lands on a completed Deferred rather than joining one in flight.
    val clientId = client.anonymousId()
    trace.mark("warm identity ready")

    val config =
        try {
            client.config.resolve()
        } catch (unavailable: FrakError) {
            // A warm-up that fails is not a failure: the sheet re-resolves and carries its own
            // tier-3 fallback for the case where that fails too.
            null
        }
    trace.mark("warm config ready")

    // Without both halves of the identity the page would render nothing, and warming a page
    // that renders nothing banks only DNS/TLS/bundle — not the queries, which are the
    // expensive part. Better to leave the view cold and let the sheet do a full load.
    if (config == null || clientId == null) return

    pool.warm(
        SharingPageUrl.warm(
            walletOrigin = walletOrigin,
            merchantId = config.merchantId,
            clientId = clientId,
            packageId = packageId,
            appName = config.sdkConfig?.name ?: config.name,
            logoUrl = config.sdkConfig?.logoUrl,
        ),
    )
}
