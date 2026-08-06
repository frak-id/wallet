package id.frak.sdk.ui

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
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

/** What the hosted page told the host. Mirrors the wallet's `HostResultAction`. */
internal sealed interface SharingPageAction {
    data object Install : SharingPageAction

    data object Dismiss : SharingPageAction

    data object ShareAgain : SharingPageAction

    /** The page asking the host to share: navigator.share does not exist in an Android WebView. */
    data object Share : SharingPageAction

    data object Copy : SharingPageAction

    data object Error : SharingPageAction

    /** The page reporting that it has painted; [SharingWebViewBinding.onPageVisible] is the fallback. */
    data object Ready : SharingPageAction

    data class Code(
        val value: String,
        /** Epoch seconds, or null when the page sent none. */
        val expiresAtSeconds: Long?,
    ) : SharingPageAction

    companion object {
        /** Unknown actions are null: the page can ship a new one before the SDK that reads it. */
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

                "ready" -> Ready

                // A code action with no code is not one; treat it as unknown.
                "code" -> value?.takeIf { it.isNotEmpty() }?.let { Code(it, exp?.toLongOrNull()) }

                else -> null
            }
    }
}

/** One sheet's worth of wiring for a [SharingWebViewHandle]. Rebinding resets per-load state. */
internal class SharingWebViewBinding(
    val sessionId: String,
    val onAction: (SharingPageAction) -> Unit = {},
    val onPageReady: () -> Unit = {},
    /** First paint, as opposed to [onPageReady]'s document-finished. Drives the skeleton. */
    val onPageVisible: () -> Unit = {},
    val onLoadFailed: () -> Unit = {},
    val onOpenExternal: (String) -> Unit = {},
) {
    companion object {
        val Warm: SharingWebViewBinding = SharingWebViewBinding(sessionId = WARM_SESSION_ID)

        /** Never a real sheet's id, so a warm page's result navigation is never attributed to one. */
        const val WARM_SESSION_ID: String = "warm"
    }
}

/** A sharing web view and its client, held here rather than read off it: `getWebViewClient` is API 26. */
internal class SharingWebViewHandle(
    val view: WebView,
    private val client: SharingWebViewClient,
) {
    /** The document [load] last pointed at; `WebView.getUrl` lags for the whole of a load. */
    var loadedBaseUrl: String? = null
        private set

    /** A fragment hung off a half-loaded document never finishes: no request is started. */
    var documentReady: Boolean = false
        private set

    /** Points the view at a session. Resets per-load state; see [SharingWebViewBinding]. */
    fun bind(binding: SharingWebViewBinding) {
        client.binding = binding
    }

    /** A full navigation. Fragment activations do not come through here — see [documentReady]. */
    fun load(url: String) {
        loadedBaseUrl = url.substringBefore('#')
        documentReady = false
        view.loadUrl(url)
    }

    fun onDocumentReady() {
        documentReady = true
    }

    var paused: Boolean = false
        private set

    /**
     * Background state while nobody is looking. `onPause` does not pause JavaScript; `pauseTimers`
     * would, but it is process-global and would reach the merchant's own web views.
     */
    fun pause() {
        if (paused) return
        paused = true
        view.onPause()
    }

    fun resume() {
        if (!paused) return
        paused = false
        view.onResume()
    }

    fun destroy() {
        view.destroy()
    }
}

/**
 * Builds the sheet's WebView. There is no visible URL bar, hence the origin pinning and no JS
 * bridge. Returns unbound: nothing is reported until [SharingWebViewHandle.bind] names a session.
 */
@SuppressLint("SetJavaScriptEnabled")
internal fun createSharingWebView(
    context: Context,
    walletOrigin: String,
    returnScheme: String,
): SharingWebViewHandle {
    val client = SharingWebViewClient(walletOrigin = walletOrigin, returnScheme = returnScheme)
    val view =
        WebView(context).apply {
            // Explicit MATCH_PARENT: a wrap-content WebView reports a 0 viewport height to Blink,
            // collapsing the page's `height: 100dvh` scroll container.
            layoutParams = ViewGroup.LayoutParams(MATCH_PARENT, MATCH_PARENT)

            settings.javaScriptEnabled = true // Page is a React app; rest of this bounds what it can reach.
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.setSupportMultipleWindows(false)
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setGeolocationEnabled(false)
            settings.cacheMode = WebSettings.LOAD_DEFAULT // Explicit default: revalidate cached responses.

            // NORMAL, not the inherited NARROW_COLUMNS default, which reflows a responsive page.
            settings.layoutAlgorithm = WebSettings.LayoutAlgorithm.NORMAL

            // Transparent, not the default opaque white: the page rounds its own top corners, and
            // they can only cut through to the scrim if this view paints no background behind them.
            setBackgroundColor(Color.TRANSPARENT)

            // Third-party cookies off. First-party wallet cookies outlive the sheet regardless:
            // Android has no per-WebView data store, and the clear API is app-global.
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)

            webViewClient = client
        }

    // Registered on the view, not per load, so every wallet-origin document it shows is styled.
    // Result unused: the page's own CSS fallbacks are the degraded rendering.
    SharingHostStyle.install(view = view, walletOrigin = walletOrigin, topRadiusDp = SHEET_CORNER_RADIUS_DP)

    return SharingWebViewHandle(view = view, client = client)
}

internal class SharingWebViewClient(
    private val walletOrigin: String,
    private val returnScheme: String,
) : WebViewClient() {
    private val origin: Uri = Uri.parse(walletOrigin)

    /** Whose session this view is currently serving. Rebinding clears every field below. */
    var binding: SharingWebViewBinding = SharingWebViewBinding.Warm
        set(value) {
            field = value
            pendingMainFrameUrl = null
            retried = false
            retryPending = false
            settled = false
            navigationFailed = false
            navigationOwnedByBinding = false
        }

    /** A pooled view is bound mid-flight, and the warm load's callbacks must not count as the session's. */
    private var navigationOwnedByBinding = false

    /** Main-frame URL currently in flight, captured in [onPageStarted]; null once resolved. */
    private var pendingMainFrameUrl: String? = null

    /** At most one cache-only retry per binding. */
    private var retried = false

    /** So a duplicate error callback for the same failure is not read as the retry itself failing. */
    private var retryPending = false

    /** Set once [SharingWebViewBinding.onLoadFailed] fires, so it fires at most once per binding. */
    private var settled = false

    /** Android still fires [onPageFinished] for its own error page, which would read as success. */
    private var navigationFailed = false

    /** Distinguishes one [WebView.postVisualStateCallback] request from a stale earlier one. */
    private var visualStateRequest = 0L

    override fun shouldOverrideUrlLoading(
        view: WebView,
        request: WebResourceRequest,
    ): Boolean {
        // A sub-frame is never launched externally, and a cross-origin one is cancelled. Only
        // remote schemes are checked: about:blank/blob:/data: frames have no host to compare.
        // setSupportMultipleWindows(false) folds `target="_blank"` into the main frame, so it is never a sub-frame.
        if (!request.isForMainFrame) {
            val remote = request.url.scheme == "https" || request.url.scheme == "http"
            return remote && !isSameOrigin(request.url)
        }

        val url = request.url

        if (url.scheme == returnScheme && url.host == SharingPageUrl.RESULT_HOST) {
            // `sid` guards against a result from an already-closed sheet, or from the warm page.
            if (url.getQueryParameter("sid") == binding.sessionId) {
                SharingPageAction
                    .fromWire(
                        action = url.getQueryParameter("action"),
                        value = url.getQueryParameter("value"),
                        exp = url.getQueryParameter("exp"),
                    )?.let(binding.onAction)
            }
            return true
        }

        // Component-by-component compare: a prefix match would accept
        // `https://wallet.frak.id.attacker.example/`.
        if (isSameOrigin(url)) return false
        binding.onOpenExternal(url.toString())
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
        navigationOwnedByBinding = true
    }

    override fun onPageFinished(
        view: WebView,
        url: String,
    ) {
        // The warm load landing after this view was lent to a sheet.
        if (!navigationOwnedByBinding) return
        // Android delivers this for its own error page too, in the same load cycle.
        if (navigationFailed) return
        // `retried` is NOT reset: one retry per binding for the sheet's whole lifetime.
        pendingMainFrameUrl = null
        view.settings.cacheMode = WebSettings.LOAD_DEFAULT // Undo handleMainFrameFailure's cache-only mode.
        val settledBinding = binding
        settledBinding.onPageReady()

        // Document-finished is not painted: React renders after `load`.
        val request = ++visualStateRequest
        view.postVisualStateCallback(
            request,
            object : WebView.VisualStateCallback() {
                override fun onComplete(requestId: Long) {
                    // A newer navigation superseded this one; its own callback owns visibility.
                    if (requestId != visualStateRequest) return
                    if (settledBinding !== binding) return
                    settledBinding.onPageVisible()
                }
            },
        )
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
        // The warm load failing after this view was lent to a sheet.
        if (!navigationOwnedByBinding) return
        // Before the `settled` guard: a later error page's onPageFinished must not report readiness.
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
            binding.onLoadFailed()
            return
        }
        if (url == null) {
            settled = true
            binding.onLoadFailed()
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
        if (!settled) {
            settled = true
            binding.onLoadFailed()
        }
        return true
    }
}
