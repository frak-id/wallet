package id.frak.sdk.ui

import android.content.Context
import android.webkit.WebView
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalContext
import id.frak.sdk.Frak

/**
 * Warms an offscreen `WebView` against the wallet origin when a share surface
 * appears, so the real sheet skips DNS/TCP/TLS/engine startup. Never reused by
 * [FrakSharingSheet]: a `WebView` can't be reparented once attached, and the
 * throwaway `sessionId` here must never satisfy the sheet's `sid` guard.
 * Gated behind [id.frak.sdk.core.FrakConfig.preloadSharing]; one warm view per
 * launcher call, so hoist [rememberFrakSharingLauncher] per screen, not per row.
 */
@Composable
internal fun WarmSharingWebView() {
    if (!Frak.isInitialized) return
    if (!Frak.preloadSharing) return
    val client = Frak.client

    val applicationContext = LocalContext.current.applicationContext
    val walletOrigin = client.environment.wallet

    DisposableEffect(Unit) {
        val warm = createWarmSharingWebView(applicationContext, walletOrigin)
        onDispose { warm.destroy() }
    }
}

/** Routed through [createSharingWebView] so hardening stays identical on both paths. */
internal fun createWarmSharingWebView(
    context: Context,
    walletOrigin: String,
): WebView =
    createSharingWebView(
        context = context,
        walletOrigin = walletOrigin,
        returnScheme = SharingPageUrl.returnScheme(context.packageName),
        sessionId = WARM_SESSION_ID,
        onAction = {},
        onPageReady = {},
        onLoadFailed = {},
        onOpenExternal = {},
    ).apply { loadUrl("$walletOrigin/sharing") }

private const val WARM_SESSION_ID = "warm"
