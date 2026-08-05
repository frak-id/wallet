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
 *
 * Answers a URL rather than warming the pool itself, and that separation is load-bearing. Both
 * reads here suspend on the network, so this coroutine's continuation can land at any point —
 * including the gap between an Activity being destroyed by a rotation and its replacement
 * attaching. Booting the pool from in here would construct the `WebView` in that gap, against the
 * application context, and a `WebView` resolves its theme, inflater and popup host at construction.
 * [SharingHost] holds the answer until it has an Activity to build against.
 */
internal suspend fun resolveWarmUrl(packageId: String): String? {
    if (!Frak.isInitialized) return null
    if (!Frak.preloadSharing) return null

    val trace = SharingTrace()
    val client = Frak.client
    val walletOrigin = client.environment.wallet

    // Both reads inside the same guard. A warm-up that fails is not a failure: the sheet
    // re-resolves and carries its own tier-3 fallback for the case where that fails too. It is
    // also not somewhere to throw from — this runs on a scope with no exception handler between it
    // and the merchant's process, and `Frak.shutdown()` mid-warm reaches `anonymousId` as readily
    // as it reaches the config resolve.
    val identity =
        try {
            // The keystore mint is already eager at initialize; awaiting it here only guarantees
            // the sheet's own read lands on a completed Deferred rather than joining one in flight.
            val clientId = client.anonymousId()
            trace.mark("warm identity ready")
            clientId to client.config.resolve().toSharingMerchant()
        } catch (unavailable: FrakError) {
            null
        }
    trace.mark("warm config ready")
    val clientId = identity?.first
    val merchant = identity?.second

    // Without both halves of the identity the page would render nothing, and warming a page
    // that renders nothing banks only DNS/TLS/bundle — not the queries, which are the
    // expensive part. Better to leave the view cold and let the sheet do a full load.
    if (merchant == null || clientId == null) return null

    return SharingPageUrl.warm(
        walletOrigin = walletOrigin,
        merchantId = merchant.merchantId,
        clientId = clientId,
        packageId = packageId,
        appName = merchant.displayName,
        logoUrl = merchant.logoUrl,
    )
}
