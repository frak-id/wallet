package id.frak.sdk.ui

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.webkit.CookieManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

/** What the hosted page told the host. Mirrors the wallet's `HostResultAction`. */
internal enum class SharingPageAction {
    Install,
    Dismiss,
    ShareAgain,
    Error,
    ;

    companion object {
        fun fromWire(value: String?): SharingPageAction? =
            when (value) {
                "install" -> Install
                "dismiss" -> Dismiss
                "shareAgain" -> ShareAgain
                "error" -> Error
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
@SuppressLint("SetJavaScriptEnabled")
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
        settings.javaScriptEnabled = true // page is a React app; rest of this bounds what it can reach
        settings.domStorageEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.setSupportMultipleWindows(false)
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.setGeolocationEnabled(false)
        settings.cacheMode = WebSettings.LOAD_DEFAULT // explicit default: revalidate cached responses

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

    override fun shouldOverrideUrlLoading(
        view: WebView,
        request: WebResourceRequest,
    ): Boolean {
        val url = request.url

        if (url.scheme == returnScheme && url.host == SharingPageUrl.RESULT_HOST) {
            // `sid` guards against a result from a sheet the user already closed.
            if (url.getQueryParameter("sid") == sessionId) {
                SharingPageAction.fromWire(url.getQueryParameter("action"))?.let(onAction)
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
    }

    override fun onPageFinished(
        view: WebView,
        url: String,
    ) {
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
}
