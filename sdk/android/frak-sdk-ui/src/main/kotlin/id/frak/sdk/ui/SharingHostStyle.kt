package id.frak.sdk.ui

import android.net.Uri
import android.util.Log
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/**
 * Injects the sheet's chrome (top radius, surface colour) into the hosted page as CSS custom
 * properties. A document-start script, not a query param, so it survives navigation to other
 * wallet routes. Both are set together: a radius without a transparent surface rounds nothing.
 */
internal object SharingHostStyle {
    /** Top-corner radius, as a CSS length. Consumed by the wallet's `containerChromeless` styles. */
    const val CSS_VAR_TOP_RADIUS: String = "--frak-host-top-radius"

    /** Page background. Consumed by the `body` rule in `packages/design-system/src/defaults.css.ts`. */
    const val CSS_VAR_SURFACE: String = "--frak-host-surface"

    /**
     * The script itself, separated from [install] so it can be asserted on without a `WebView`.
     * Appended to `documentElement` because at document start nothing inside it exists yet.
     */
    fun script(topRadiusDp: Int): String =
        "(function(){var s=document.createElement('style');" +
            "s.textContent=':root{$CSS_VAR_TOP_RADIUS:${topRadiusDp}px;$CSS_VAR_SURFACE:transparent}';" +
            "document.documentElement.appendChild(s)})()"

    /**
     * Registers [script] for every wallet-origin document this view loads, for the life of the
     * view. False on a WebView older than the API (roughly M96); the page then falls back to square
     * corners on an opaque surface, and the reason is logged.
     */
    fun install(
        view: WebView,
        walletOrigin: String,
        topRadiusDp: Int,
    ): Boolean {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            Log.w(
                TAG,
                "WebView does not support DOCUMENT_START_SCRIPT; the sharing sheet will render " +
                    "square corners on an opaque surface. Update Android System WebView.",
            )
            return false
        }
        val rule = originRule(walletOrigin)
        // `addDocumentStartJavaScript` throws on an unparseable origin rule, and `walletOrigin` is
        // merchant-supplied — square corners beat taking the host app down.
        return runCatching {
            WebViewCompat.addDocumentStartJavaScript(view, script(topRadiusDp), setOf(rule))
        }.onFailure {
            Log.w(TAG, "Rejected origin rule \"$rule\"; the sharing sheet will render square corners.", it)
        }.isSuccess
    }

    private const val TAG: String = "FrakSharing"

    /**
     * [walletOrigin] reduced to the `scheme://host[:port]` an origin rule may contain; a custom
     * environment can carry a path, which the rule grammar rejects. Returns the input untouched
     * when it cannot be parsed at all.
     */
    internal fun originRule(walletOrigin: String): String {
        val parsed = Uri.parse(walletOrigin)
        val scheme = parsed.scheme ?: return walletOrigin
        val authority = parsed.authority ?: return walletOrigin
        return "$scheme://$authority"
    }
}
