package id.frak.sdk.ui

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
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

    /**
     * This view's render process was reclaimed or crashed. Terminal: Android's contract is that a
     * `WebView` whose renderer is gone is unusable for good, so [SharingWebViewPool] discards it
     * rather than loading into it again.
     */
    var rendererGone: Boolean = false
        private set

    /**
     * Called from [SharingWebViewClient.onRenderProcessGone], which cannot reach this handle
     * itself. Clearing [documentReady] is what stops the next sheet activating by fragment into a
     * document that no longer exists.
     */
    fun onRendererGone() {
        rendererGone = true
        documentReady = false
    }

    /** Points the view at a session. Resets per-load state; see [SharingWebViewBinding]. */
    fun bind(binding: SharingWebViewBinding) {
        // Belt and braces: nothing sets a non-default cache mode any more, and a pinned one would
        // be inherited silently by the pool's re-warm and by every later sheet.
        view.settings.cacheMode = WebSettings.LOAD_DEFAULT
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
        // The client can be holding a retry scheduled against this view. It is posted to the main
        // looper, not to the view's own queue, so nothing else stops it — and `loadUrl` after
        // `destroy()` takes the merchant's process down. The pool reaches here without rebinding
        // first (a dead pool releasing a lent view, or destroying a warm one), so the binding
        // setter's own cancellation does not cover this.
        client.cancelPendingRetry()
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
    // Gated on the host app's own debuggable flag, not on a Frak log level: `setWebContentsDebuggingEnabled`
    // is process-global and exposes the wallet session to anything that can reach the ADB socket.
    val debuggable = (context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
    if (debuggable) WebView.setWebContentsDebuggingEnabled(true)
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
            // The page is the only thing in the sheet that can fail silently; without this a
            // merchant debugging a blank sheet has no signal at all.
            if (debuggable) webChromeClient = SharingConsoleClient()
        }

    // Registered on the view, not per load, so every wallet-origin document it shows is styled.
    // Result unused: the page's own CSS fallbacks are the degraded rendering.
    SharingHostStyle.install(view = view, walletOrigin = walletOrigin, topRadiusDp = SHEET_CORNER_RADIUS_DP)

    // Wired after construction rather than passed in: the client is built first, and this is the
    // only way back from it to the state a renderer crash invalidates.
    return SharingWebViewHandle(view = view, client = client).also {
        client.onRendererGone = it::onRendererGone
    }
}

/** Console forwarder for a debuggable host build. Returns true so the default logcat line is not also emitted. */
private class SharingConsoleClient : WebChromeClient() {
    override fun onConsoleMessage(message: ConsoleMessage): Boolean {
        Log.d(
            "FrakSharing",
            "page: ${message.message()} (${message.sourceId()}:${message.lineNumber()})",
        )
        return true
    }
}

internal class SharingWebViewClient(
    private val walletOrigin: String,
    private val returnScheme: String,
) : WebViewClient() {
    private val origin: Uri = Uri.parse(walletOrigin)

    /** Where a backed-off retry is posted. See [scheduleRetry] for why it is not the view's own queue. */
    private val handler = Handler(Looper.getMainLooper())

    /**
     * Told when this view's render process dies. Set once per view, not per binding: a renderer
     * crash outlives whichever session was using it, and the [SharingWebViewHandle] holding the
     * state it invalidates is not reachable from here.
     */
    var onRendererGone: () -> Unit = {}

    /** Whose session this view is currently serving. Rebinding clears every field below. */
    var binding: SharingWebViewBinding = SharingWebViewBinding.Warm
        set(value) {
            field = value
            // Before the counters: a retry booked by the previous session would otherwise navigate
            // this view to that session's URL, on a pool that has already moved on.
            cancelPendingRetry()
            pendingMainFrameUrl = null
            retryCount = 0
            ladderUrl = null
            retryPending = false
            settled = false
            navigationFailed = false
            navigationOwnedByBinding = false
        }

    /** A pooled view is bound mid-flight, and the warm load's callbacks must not count as the session's. */
    private var navigationOwnedByBinding = false

    /** Main-frame URL currently in flight, captured in [onPageStarted]; null once resolved. */
    private var pendingMainFrameUrl: String? = null

    /** Rungs of [RETRY_LADDER] already spent on the document in [ladderUrl]. */
    private var retryCount = 0

    /**
     * Which document the spent rungs belong to. A session navigates more than once — the install
     * page, and the confirmation screen — and a fresh document has not failed yet, so it must not
     * inherit a budget the sharing page spent.
     */
    private var ladderUrl: String? = null

    /** The scheduled retry, held so a rebind can cancel one that would navigate the next session's view. */
    private var pendingRetry: Runnable? = null

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
        // The ladder is NOT reset here: rungs belong to a document, not to an attempt at it, so a
        // load that only succeeded on its retry must not hand a later failure a full budget again.
        pendingMainFrameUrl = null
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
        if (request.isForMainFrame) handleMainFrameFailure(view, unreachable = isUnreachable(error))
    }

    override fun onReceivedHttpError(
        view: WebView,
        request: WebResourceRequest,
        errorResponse: WebResourceResponse,
    ) {
        // An answer, however bad, means the network is there; this is the retryable kind.
        if (request.isForMainFrame) handleMainFrameFailure(view, unreachable = false)
    }

    /**
     * The network itself did not answer. Another attempt over it is pointless, so the ladder skips
     * straight to its cache-only rung rather than spending the sheet's budget on a dead radio.
     */
    private fun isUnreachable(error: WebResourceError): Boolean =
        error.errorCode == WebViewClient.ERROR_HOST_LOOKUP || error.errorCode == WebViewClient.ERROR_CONNECT

    /**
     * A main-frame failure gets the rest of [RETRY_LADDER] before tier 3. All rungs are network
     * rungs: the hosted document is served `no-store`, so it is never in the HTTP cache and a
     * cache-only attempt cannot answer — an unreachable network goes straight to tier 3.
     */
    private fun handleMainFrameFailure(
        view: WebView,
        unreachable: Boolean,
    ) {
        // The warm load failing after this view was lent to a sheet.
        if (!navigationOwnedByBinding) return
        // Before the `settled` guard: a later error page's onPageFinished must not report readiness.
        navigationFailed = true
        if (settled) return
        // Duplicate callback for the failure that already booked the next rung.
        if (retryPending) return
        val url = pendingMainFrameUrl
        if (url == null) {
            giveUp(view)
            return
        }
        // A document this ladder has not been spent on yet gets the whole thing.
        if (url != ladderUrl) {
            ladderUrl = url
            retryCount = 0
        }
        // Nothing to retry against, and no cached copy to fall back on.
        if (unreachable) {
            giveUp(view)
            return
        }
        val delayMillis = RETRY_LADDER.getOrNull(retryCount)
        if (delayMillis == null) {
            giveUp(view)
            return
        }
        retryCount++
        retryPending = true
        scheduleRetry(delayMillis) { view.loadUrl(url) }
    }

    /** The ladder is spent. */
    private fun giveUp(view: WebView) {
        view.settings.cacheMode = WebSettings.LOAD_DEFAULT
        settled = true
        binding.onLoadFailed()
    }

    /**
     * Posted to the main looper rather than through [WebView.postDelayed]: the pooled view can be
     * detached here, and a `View`'s own queue parks runnables until it is attached to a window.
     */
    private fun scheduleRetry(
        delayMillis: Long,
        navigate: () -> Unit,
    ) {
        cancelPendingRetry()
        val runnable =
            Runnable {
                pendingRetry = null
                retryPending = false
                navigate()
            }
        pendingRetry = runnable
        handler.postDelayed(runnable, delayMillis)
    }

    /** Also reached from [SharingWebViewHandle.destroy], which is not a rebind. */
    fun cancelPendingRetry() {
        pendingRetry?.let(handler::removeCallbacks)
        pendingRetry = null
    }

    override fun onRenderProcessGone(
        view: WebView,
        detail: RenderProcessGoneDetail,
    ): Boolean {
        // MUST return true — false lets the framework kill the host app, not just the sheet.
        // Reported before the `settled` guard below: the view is unusable whether or not this
        // binding still has a failure to report.
        onRendererGone()
        // A view whose renderer is gone cannot load anything, so a booked retry would only navigate
        // a corpse and keep the sheet waiting on it.
        cancelPendingRetry()
        if (!settled) {
            settled = true
            binding.onLoadFailed()
        }
        return true
    }

    private companion object {
        /**
         * Delays a main-frame failure gets before tier 3, in order. Two rungs, sized to fit inside
         * the sheet's own load budget alongside the attempts themselves — a third would expire it.
         */
        val RETRY_LADDER = listOf(300L, 900L)
    }
}
