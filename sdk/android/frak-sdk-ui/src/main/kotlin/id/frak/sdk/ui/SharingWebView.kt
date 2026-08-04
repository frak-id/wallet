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
 * [Code] carries a value; every other action deliberately does not. Safe only because this
 * navigation is consumed by [SharingWebViewClient.shouldOverrideUrlLoading] and never reaches
 * the OS.
 */
internal sealed interface SharingPageAction {
    data object Install : SharingPageAction

    data object Dismiss : SharingPageAction

    data object ShareAgain : SharingPageAction

    /**
     * The page's own Share button. An ask, not a report — navigator.share doesn't exist in an
     * Android WebView, and the interaction has to be signed by a keypair the page can't reach.
     */
    data object Share : SharingPageAction

    /** The page's own Copy button. Same division as [Share] — see its doc. */
    data object Copy : SharingPageAction

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

                "share" -> Share

                "copy" -> Copy

                "error" -> Error

                // A code action with no code is not one; treat it as unknown.
                "code" -> value?.takeIf { it.isNotEmpty() }?.let { Code(it, exp?.toLongOrNull()) }

                else -> null
            }
    }
}

/**
 * Builds the sheet's WebView. No visible URL bar, so a cross-origin navigation would be
 * indistinguishable from trusted content — hence the origin pinning and no JS bridge below. No
 * service-worker offline shell for a never-before-visited sheet; [SharingWebViewClient] covers
 * the previously-visited case via a cache-only retry.
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
        // MATCH_PARENT, explicit: a wrap-content WebView reports a 0 viewport height to Blink
        // (vh/dvh/svh/lvh all resolve to 0 while clientHeight reads the real height), which
        // collapsed the page's `height: 100dvh` scroll container to zero.
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

        // NORMAL, not the inherited NARROW_COLUMNS default: that reflows content to the view
        // width on its own heuristics, which a responsive page laid out for a phone viewport
        // doesn't want.
        settings.layoutAlgorithm = WebSettings.LayoutAlgorithm.NORMAL

        // The page scrolls itself but lives inside a ModalBottomSheet whose drag gesture would
        // otherwise swallow every vertical drag before the web content sees it. Claiming the
        // gesture only when the content can actually scroll leaves swipe-to-dismiss working on
        // a page short enough not to.
        setOnTouchListener { view, event ->
            if (event.actionMasked == MotionEvent.ACTION_DOWN) {
                val scrollable = view.canScrollVertically(-1) || view.canScrollVertically(1)
                view.parent?.requestDisallowInterceptTouchEvent(scrollable)
            }
            false // the WebView still handles the event itself
        }
        // Third-party cookies off. Android has no per-WebView data store, so first-party wallet
        // cookies outlive the sheet regardless; clearing on dismiss isn't an option either,
        // since that API is app-global.
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
     * True between issuing the cache-only retry and it starting. Without this, a duplicate
     * error callback for the same failure would look like the retry itself failing and reset
     * cacheMode before the retry's own loadUrl dispatches. [onPageStarted] clears it.
     */
    private var retryPending = false

    /** Set once [onLoadFailed] fires, so it fires at most once per client instance. */
    private var settled = false

    /**
     * Set when the in-flight main-frame navigation reports an error. Android still fires
     * [onPageFinished] for its own error page, which without this flag would read as a
     * successful load and cancel the tier-3 deadline.
     */
    private var navigationFailed = false

    override fun shouldOverrideUrlLoading(
        view: WebView,
        request: WebResourceRequest,
    ): Boolean {
        // A sub-frame is never launched externally (that would let an embedded frame yank the
        // user out of the sheet), and a cross-origin one is cancelled rather than rendered —
        // the origin pinning this exists to enforce. Only remote schemes are checked:
        // about:blank/blob:/data: frames have no host to compare and are routine inside a React
        // page. target="_blank" never arrives here as a sub-frame — setSupportMultipleWindows(false)
        // folds it into the main frame.
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
        // failure. Reporting readiness here would kill the tier-3 fallback.
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
        // MUST return true — false lets the framework kill the host app, not just the sheet.
        // Recovery would mean reloading the content that just crashed a process; tier 3 already
        // has a working locally-built link.
        if (!settled) {
            settled = true
            onLoadFailed()
        }
        return true
    }
}
