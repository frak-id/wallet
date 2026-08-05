package id.frak.sdk.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import id.frak.sdk.Frak
import id.frak.sdk.core.FrakError

/**
 * Warms the data the sheet needs before it can build a URL at all.
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
 * The reward is deliberately not warmed here. `RewardRepository`'s cache is keyed on the encoded
 * product list, so a warm-up without the request's products mints a different key and buys the
 * sheet nothing.
 */
@Composable
internal fun WarmSharingData() {
    if (!Frak.isInitialized) return
    if (!Frak.preloadSharing) return

    LaunchedEffect(Unit) {
        val trace = SharingTrace()
        val client = Frak.client

        // The keystore mint is already eager at initialize; awaiting it here only guarantees the
        // sheet's own read lands on a completed Deferred rather than joining one in flight.
        client.anonymousId()
        trace.mark("warm identity ready")

        try {
            client.config.resolve()
        } catch (unavailable: FrakError) {
            // A warm-up that fails is not a failure: the sheet re-resolves and carries its own
            // tier-3 fallback for the case where that fails too.
        }
        trace.mark("warm config ready")
    }
}
