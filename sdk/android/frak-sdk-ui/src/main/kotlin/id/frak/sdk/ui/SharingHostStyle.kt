package id.frak.sdk.ui

import android.net.Uri
import android.util.Log
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/**
 * How the sheet tells the hosted page what its own chrome looks like.
 *
 * ## Why the page has to be told at all
 *
 * The sheet presents the web view rectangularly and lets the page draw the sheet's own top
 * corners. That is not a stylistic choice — a `WebView` draws through the `AwDrawFn` GPU functor,
 * whose ABI carries `clip_left/top/right/bottom` and nothing else, so a round-rect clip cannot be
 * handed down to it. HWUI's answer is `GLFunctorDrawable::onDraw`'s slow branch, which for a
 * complex clip region does a stencil clear, a stencil write, a `flushAndSubmit` and a second
 * stencil clear **around every functor draw**. That applies to `Modifier.clip`,
 * `View.setClipToOutline` and every other spelling of "round this view" equally, so there is no
 * native lever to prefer here — unlike iOS, where a `WKWebView` is a real `CALayer` and
 * `cornerRadius` is composited for free.
 *
 * ## Why not a query parameter
 *
 * It was one, briefly, and it was the wrong shape. A parameter is addressed to a *route*: the
 * sheet loads `/sharing`, but it also navigates the same web view to `/install` when the page's
 * install CTA is pressed, and that route never got the parameter — so the corners squared off
 * halfway through the flow. Every future route would owe the same tax, and the warm-up URL had to
 * carry a byte-identical copy of the value or same-document activation would silently fall back to
 * a full load.
 *
 * A document-start script is addressed to an *origin*. Registered once on the view, it applies to
 * `/sharing`, `/install`, and anything either of them navigates to on the wallet origin, with no
 * per-route contract to keep in step and nothing to desynchronise.
 *
 * ## The contract
 *
 * Two CSS custom properties on `:root`, consumed by the wallet's own stylesheets:
 *
 * | Property | Meaning | Page-side fallback when unset |
 * |---|---|---|
 * | [CSS_VAR_TOP_RADIUS] | radius the page rounds its top corners to | `0px`, i.e. square |
 * | [CSS_VAR_SURFACE] | page background | its normal opaque surface colour |
 *
 * Both are set together on purpose. Rounded corners are only visible if something shows through
 * them, and a `body` background propagates to the document canvas, which no `border-radius`
 * clips — so a radius without a transparent surface rounds nothing.
 *
 * A host that wants neither (iOS: a SwiftUI `.sheet` already clips to the system radius, and a
 * second arc inside it reads as a double corner) simply never calls this, and the page's
 * fallbacks are exactly its web behaviour.
 */
internal object SharingHostStyle {
    /**
     * Top-corner radius, as a CSS length.
     *
     * Read by `containerChromeless` in `packages/wallet-shared/.../sharing/component/shared.css.ts`
     * and by `containerChromeless` in `apps/wallet/app/routes/install.css.ts`. Renaming it is a
     * cross-repository change.
     */
    const val CSS_VAR_TOP_RADIUS: String = "--frak-host-top-radius"

    /**
     * Page background.
     *
     * Read by the `body` rule in `packages/design-system/src/defaults.css.ts`, which resolves it
     * against its normal surface colour, so an unset value is the web appearance.
     */
    const val CSS_VAR_SURFACE: String = "--frak-host-surface"

    /**
     * The script itself, separated from the call that installs it so it can be asserted on
     * without a `WebView`.
     *
     * Appended to `documentElement` rather than `head`: at document start the parser has produced
     * the root element and not necessarily anything inside it. A `<style>` is valid there and the
     * cascade does not care which ancestor carried it.
     *
     * 1 CSS px == 1 dp inside a web view at `width=device-width`, so [topRadiusDp] crosses
     * unconverted.
     */
    fun script(topRadiusDp: Int): String =
        "(function(){var s=document.createElement('style');" +
            "s.textContent=':root{$CSS_VAR_TOP_RADIUS:${topRadiusDp}px;$CSS_VAR_SURFACE:transparent}';" +
            "document.documentElement.appendChild(s)})()"

    /**
     * Registers [script] for every wallet-origin document this view loads, for the life of the
     * view.
     *
     * Returns whether it took, and says so in the log either way it fails — the return value is a
     * convenience for tests and for a caller that wants it, never the only signal. A sheet that
     * quietly loses its corners on one device is exactly the report that arrives as "corners look
     * wrong on the Samsung" with nothing to go on, so the failure has to be visible without anyone
     * having thought to read a boolean.
     *
     * `Log.w` unconditionally, unlike [SharingTrace]'s tag-gated marks: this is a degradation that
     * already happened, not a timing measurement someone opts into. It fires at most once per web
     * view, only on failure.
     *
     * False on a WebView older than the API (roughly M96, late 2021), where the page falls back to
     * square corners on an opaque surface inside a rectangular sheet: visibly plainer, entirely
     * functional, and not worth an `evaluateJavascript` in `onPageFinished` to half-fix — that
     * lands after first paint, so it would trade square corners for a corner that visibly pops a
     * frame late.
     *
     * `allowedOriginRules` is the wallet origin alone, reduced by [originRule]. The script is inert
     * (it sets two custom properties), but the sheet's web view has no URL bar, so scoping what it
     * can reach is the same discipline as [SharingWebViewClient]'s origin pinning.
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
        // Translated to a boolean rather than propagated: `addDocumentStartJavaScript` throws
        // `IllegalArgumentException` on an origin rule it cannot parse, and `walletOrigin` is
        // merchant-supplied through `FrakConfig`. A sheet that renders square is a far better
        // answer than one that takes the host app down over a corner radius.
        return runCatching {
            WebViewCompat.addDocumentStartJavaScript(view, script(topRadiusDp), setOf(rule))
        }.onFailure {
            Log.w(TAG, "Rejected origin rule \"$rule\"; the sharing sheet will render square corners.", it)
        }.isSuccess
    }

    /** Shared with [SharingTrace] so one `adb logcat -s FrakSharing` catches both. */
    private const val TAG: String = "FrakSharing"

    /**
     * [walletOrigin] reduced to what an origin rule may actually contain.
     *
     * The rule grammar is `scheme://host[:port]` (or `*`) — no path, no trailing slash, no query.
     * `FrakEnvironment.Custom` validates its wallet origin's scheme and host and strips a trailing
     * slash, but it does not reject a path, so a stub environment configured as
     * `https://stub.example/frak` reaches here intact. Passed through, that rule throws and the
     * whole sheet silently loses its corners on every route — the least debuggable possible
     * outcome for a typo in a dev-only config.
     *
     * Reduced rather than rejected: a path in the origin is a mistake about the *rule*, not about
     * which site the page is on, and the pages this styles are on the host and port either way.
     *
     * Falls back to the input untouched when it cannot be parsed at all, so a value this does not
     * understand still reaches `addDocumentStartJavaScript`'s own validation rather than being
     * quietly rewritten into something else.
     */
    internal fun originRule(walletOrigin: String): String {
        val parsed = Uri.parse(walletOrigin)
        val scheme = parsed.scheme ?: return walletOrigin
        val authority = parsed.authority ?: return walletOrigin
        return "$scheme://$authority"
    }
}
