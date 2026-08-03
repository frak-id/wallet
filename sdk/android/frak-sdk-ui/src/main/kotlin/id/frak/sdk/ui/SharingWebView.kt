package id.frak.sdk.ui

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.view.MotionEvent
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * What the hosted page told the host. Mirrors the wallet's `HostResultAction`.
 *
 * [Code] carries a value, which every other action deliberately does not. That is permitted
 * only because this navigation is consumed by [SharingWebViewClient.shouldOverrideUrlLoading]
 * and never reaches the OS — `01-platform-changes.md` §1.2 states the condition. Anything else
 * wanting a payload has to re-check it.
 */
internal sealed interface SharingPageAction {
    data object Install : SharingPageAction

    data object Dismiss : SharingPageAction

    data object ShareAgain : SharingPageAction

    data object Error : SharingPageAction

    data class Code(
        val value: String,
        /** Epoch seconds, or null when the page sent none. */
        val expiresAtSeconds: Long?,
    ) : SharingPageAction

    companion object {
        /**
         * Unknown actions are null, not a failure: the page can ship a new one before the SDK
         * that reads it, and a no-op is the forward-compatible answer.
         */
        fun fromWire(
            action: String?,
            value: String? = null,
            exp: String? = null,
        ): SharingPageAction? =
            when (action) {
                "install" -> Install

                "dismiss" -> Dismiss

                "shareAgain" -> ShareAgain

                "error" -> Error

                // A code action with no code is not one; treat it as unknown.
                "code" -> value?.takeIf { it.isNotEmpty() }?.let { Code(it, exp?.toLongOrNull()) }

                else -> null
            }
    }
}

/**
 * Builds the sheet's WebView. No visible URL bar, so a cross-origin navigation
 * would be indistinguishable from trusted content — hence the origin pinning
 * and no JS bridge below. No service-worker offline shell for a
 * never-before-visited sheet (wallet's worker only handles push, not fetch);
 * [SharingWebViewClient] covers the previously-visited case via a cache-only retry.
 */
@SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
@Suppress("LongParameterList")
internal fun createSharingWebView(
    context: Context,
    walletOrigin: String,
    returnScheme: String,
    sessionId: String,
    onAction: (SharingPageAction) -> Unit,
    onPageReady: () -> Unit,
    onLoadFailed: () -> Unit,
    onOpenExternal: (String) -> Unit,
): WebView =
    WebView(context).apply {
        // MATCH_PARENT, explicitly. A view handed to Compose's `AndroidView` with no layout
        // params is measured `wrap_content`, and a wrap-content WebView reports a viewport
        // height of 0 to Blink: `vh`, `dvh`, `svh` and `lvh` all resolve to 0 while
        // `documentElement.clientHeight` still reads the real height. The hosted page sizes its
        // scroll container with `height: 100dvh`, so that collapsed the whole
        // `html > body > #root > container` chain to zero — which is why the page painted in
        // fragments and could not be scrolled at all: its scroller had `clientHeight: 0`.
        layoutParams = ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT)

        settings.javaScriptEnabled = true // page is a React app; rest of this bounds what it can reach
        settings.domStorageEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.setSupportMultipleWindows(false)
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.setGeolocationEnabled(false)
        settings.cacheMode = WebSettings.LOAD_DEFAULT // explicit default: revalidate cached responses

        // NORMAL, not the inherited `NARROW_COLUMNS` default. That default is deprecated, is
        // documented as only for pre-KitKat, and reflows content to the view width on its own
        // heuristics — which a responsive page laid out for a phone viewport does not want, and
        // which shows up as text sized and wrapped unlike anywhere else the same page runs.
        // NORMAL is the "no rendering changes" option the WebView docs recommend.
        settings.layoutAlgorithm = WebSettings.LayoutAlgorithm.NORMAL

        // The page scrolls itself (reward card, product cards, stepper, FAQ), and it lives
        // inside a ModalBottomSheet whose drag gesture would otherwise swallow every vertical
        // drag before the web content saw it — the sheet is not a scroll container Compose can
        // hand off to, so it treats the whole drag as its own. Claiming the gesture only while
        // the content actually has somewhere to go leaves swipe-to-dismiss working on a page
        // short enough not to scroll, and the scrim and the drag handle work regardless.
        setOnTouchListener { view, event ->
            if (event.actionMasked == MotionEvent.ACTION_DOWN) {
                val scrollable = view.canScrollVertically(-1) || view.canScrollVertically(1)
                view.parent?.requestDisallowInterceptTouchEvent(scrollable)
            }
            false // the WebView still handles the event itself
        }
        // Third-party cookies off. Android has no per-WebView data store (only a
        // process-wide dir set once via setDataDirectorySuffix before any WebView
        // exists), so first-party wallet cookies do outlive the sheet; clearing on
        // dismiss isn't an option either since that API is app-global.
        CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)

        webViewClient =
            SharingWebViewClient(
                walletOrigin = walletOrigin,
                returnScheme = returnScheme,
                sessionId = sessionId,
                onAction = onAction,
                onPageReady = onPageReady,
                onLoadFailed = onLoadFailed,
                onOpenExternal = onOpenExternal,
            )
    }

private class SharingWebViewClient(
    private val walletOrigin: String,
    private val returnScheme: String,
    private val sessionId: String,
    private val onAction: (SharingPageAction) -> Unit,
    private val onPageReady: () -> Unit,
    private val onLoadFailed: () -> Unit,
    private val onOpenExternal: (String) -> Unit,
) : WebViewClient() {
    private val origin: Uri = Uri.parse(walletOrigin)

    /** Main-frame URL currently in flight, captured in [onPageStarted]; null once resolved. */
    private var pendingMainFrameUrl: String? = null

    /** At most one cache-only retry per client (one client per sheet instance). */
    private var retried = false

    /**
     * True between issuing the cache-only retry and it actually starting. A failed
     * navigation can raise both [onReceivedError] and [onReceivedHttpError]; without
     * this guard the second callback for the same failure looks like the retry
     * failing and resets cacheMode before loadUrl's posted navigation dispatches,
     * sending the retry to the network instead of the cache. [onPageStarted] clears it.
     */
    private var retryPending = false

    /** Set once [onLoadFailed] fires, so it fires at most once per client instance. */
    private var settled = false

    /**
     * Set when the in-flight main-frame navigation reports an error. Android then fires
     * [onPageFinished] for its own error page, which without this reads as a successful load:
     * it would undo the cache-only pinning and cancel the deadline that drives tier 3.
     */
    private var navigationFailed = false

    override fun shouldOverrideUrlLoading(
        view: WebView,
        request: WebResourceRequest,
    ): Boolean {
        // A sub-frame must not be launched externally — that would let an embedded frame yank the
        // user out of the sheet — and a cross-origin one is cancelled rather than rendered, since
        // a full-bleed foreign frame in a sheet with no URL bar is exactly the indistinguishability
        // the origin pinning exists to prevent. Only remote schemes are judged: `about:blank`,
        // `blob:` and `data:` frames have no host to compare and are routine inside a React page.
        // `target="_blank"` never arrives here as a sub-frame — setSupportMultipleWindows(false)
        // folds it into the main frame, which is the behaviour iOS has to reproduce by hand.
        if (!request.isForMainFrame) {
            val remote = request.url.scheme == "https" || request.url.scheme == "http"
            return remote && !isSameOrigin(request.url)
        }

        val url = request.url

        if (url.scheme == returnScheme && url.host == SharingPageUrl.RESULT_HOST) {
            // `sid` guards against a result from a sheet the user already closed.
            if (url.getQueryParameter("sid") == sessionId) {
                SharingPageAction
                    .fromWire(
                        action = url.getQueryParameter("action"),
                        value = url.getQueryParameter("value"),
                        exp = url.getQueryParameter("exp"),
                    )?.let(onAction)
            }
            return true
        }

        // Component-by-component compare: a prefix match would accept
        // `https://wallet.frak.id.attacker.example/`.
        if (isSameOrigin(url)) return false
        onOpenExternal(url.toString())
        return true
    }

    private fun isSameOrigin(url: Uri): Boolean =
        url.scheme == origin.scheme &&
            url.host.equals(origin.host, ignoreCase = true) &&
            url.port == origin.port

    override fun onPageStarted(
        view: WebView,
        url: String,
        favicon: Bitmap?,
    ) {
        pendingMainFrameUrl = url
        retryPending = false
        navigationFailed = false
    }

    override fun onPageFinished(
        view: WebView,
        url: String,
    ) {
        // Android delivers this for its own error page too, in the same load cycle as the
        // failure. Reporting readiness here is what kills the tier-3 fallback.
        if (navigationFailed) return
        // `retried` is NOT reset: one retry per client for the sheet's whole lifetime.
        pendingMainFrameUrl = null
        view.settings.cacheMode = WebSettings.LOAD_DEFAULT // undo handleMainFrameFailure's cache-only mode
        onPageReady()
    }

    override fun onReceivedError(
        view: WebView,
        request: WebResourceRequest,
        error: WebResourceError,
    ) {
        // Sub-resource failures degrade on their own; only the document matters.
        if (request.isForMainFrame) handleMainFrameFailure(view)
    }

    override fun onReceivedHttpError(
        view: WebView,
        request: WebResourceRequest,
        errorResponse: WebResourceResponse,
    ) {
        if (request.isForMainFrame) handleMainFrameFailure(view)
    }

    /** One cache-only retry so a live-but-erroring or offline-but-visited-before load can still paint. */
    private fun handleMainFrameFailure(view: WebView) {
        // Before the `settled` guard: a reload that fails after tier 3 has already fired still
        // gets an error page, whose onPageFinished must not report readiness.
        navigationFailed = true
        if (settled) return
        val url = pendingMainFrameUrl
        // Duplicate callback for the failure that already triggered the retry.
        if (retryPending) {
            return
        }
        if (retried) {
            view.settings.cacheMode = WebSettings.LOAD_DEFAULT
            settled = true
            onLoadFailed()
            return
        }
        if (url == null) {
            settled = true
            onLoadFailed()
            return
        }
        retried = true
        retryPending = true
        view.settings.cacheMode = WebSettings.LOAD_CACHE_ONLY
        view.loadUrl(url)
    }

    override fun onRenderProcessGone(
        view: WebView,
        detail: RenderProcessGoneDetail,
    ): Boolean {
        // MUST return true. Returning false lets the framework kill the host app, not just
        // the sheet. Recovery would mean reloading the content that just crashed a process;
        // tier 3 already has a working locally-built link.
        if (!settled) {
            settled = true
            onLoadFailed()
        }
        return true
    }
}
