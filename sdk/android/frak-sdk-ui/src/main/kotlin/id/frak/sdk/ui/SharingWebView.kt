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

    /**
     * The page has painted. Not an outcome — the only action here that reports progress rather
     * than a user's decision.
     *
     * Better than the [SharingWebViewBinding.onPageVisible] heuristic it supersedes: that one
     * is `postVisualStateCallback` on document load, which answers "the web view has drawn a
     * frame", not "the frame has the sharing page in it". The page knows the difference and
     * this is it saying so. The heuristic stays as the fallback for wallet builds too old to
     * send this.
     */
    data object Ready : SharingPageAction

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

                "ready" -> Ready

                // A code action with no code is not one; treat it as unknown.
                "code" -> value?.takeIf { it.isNotEmpty() }?.let { Code(it, exp?.toLongOrNull()) }

                else -> null
            }
    }
}

/**
 * One sheet's worth of wiring for a [SharingWebViewHandle].
 *
 * Split from the view so a view can outlive a sheet: [SharingWebViewPool] boots one against the
 * wallet origin long before any session exists, and the sheet binds its own session onto that
 * already-warm view at present time. Rebinding also resets the client's per-load state, so a
 * retry consumed by the warm load can't count against the real one.
 */
internal class SharingWebViewBinding(
    val sessionId: String,
    val onAction: (SharingPageAction) -> Unit = {},
    val onPageReady: () -> Unit = {},
    /**
     * First paint, as opposed to [onPageReady]'s document-finished. Drives the skeleton, which
     * must not lift onto a blank page — `onPageFinished` lands before React has rendered.
     */
    val onPageVisible: () -> Unit = {},
    val onLoadFailed: () -> Unit = {},
    val onOpenExternal: (String) -> Unit = {},
) {
    companion object {
        /**
         * What an unpresented, warm view carries. [WARM_SESSION_ID] can never satisfy a real
         * sheet's `sid` guard, so a result navigation from the warm page is dropped rather than
         * attributed to whichever session binds next.
         */
        val Warm: SharingWebViewBinding = SharingWebViewBinding(sessionId = WARM_SESSION_ID)

        /** Never a real sheet's id, so a warm page's result navigation can never be attributed to one. */
        const val WARM_SESSION_ID: String = "warm"
    }
}

/**
 * A sharing web view and the client that drives it.
 *
 * The client is held here rather than read back off the view: `WebView.getWebViewClient` is
 * API 26 and this SDK's floor is 24.
 */
internal class SharingWebViewHandle(
    val view: WebView,
    private val client: SharingWebViewClient,
) {
    /**
     * The document [load] last pointed the view at, or null if it has never been pointed
     * anywhere. What makes a same-document activation decidable: hanging a fragment off a URL is
     * only free if that URL is the one already loaded.
     *
     * Tracked here rather than read back from `WebView.getUrl`, which reports the *committed*
     * URL and so still answers with the previous page for the whole of a load in flight —
     * exactly the window this is consulted in.
     */
    var loadedBaseUrl: String? = null
        private set

    /**
     * Whether [loadedBaseUrl] actually finished loading.
     *
     * Load-bearing, not diagnostic. Warming is usually still in flight when the user taps, and
     * hanging a fragment off a half-loaded document would leave the page stuck exactly where it
     * got to — a fragment change starts no request, so nothing would ever finish it. A session
     * that cannot activate must do a full load instead.
     *
     * Only meaningful while the pool owns the handle. Once lent, the session drives the view
     * directly and this stops tracking it; the pool reloads from scratch on release anyway.
     */
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

    /** Called by the owner when this handle's document reports itself finished. */
    fun onDocumentReady() {
        documentReady = true
    }

    /** Whether [pause] has been called without a matching [resume]. */
    var paused: Boolean = false
        private set

    /**
     * Puts the pooled view into the background state while nobody is looking at it.
     *
     * A warm view sits on a fully booted React app for as long as the merchant's share surface is
     * composed. `WebView.onPause` is the per-instance lever for that, and it is worth being precise
     * about what it does buy, because it is less than it sounds: Android documents it as a
     * "best-effort attempt to pause any processing that can be paused safely, such as animations and
     * geolocation", and explicitly says **it does not pause JavaScript**. So the page's timers and
     * its `requestAnimationFrame` loop keep running; what stops is native-side drawing and
     * compositing work for a view nobody is showing.
     *
     * `pauseTimers` is the API that would stop the JS half, and it is deliberately not used: it is
     * process-global and would reach the merchant's own web views.
     *
     * The size of the win is unmeasured — no device trace has been taken of this SDK's sheet at
     * all. It is kept because it is free, it is what Shopify's checkout sheet does with its own
     * preloaded view, and it cannot make anything worse.
     *
     * Applied only once the document has finished, never mid-load: the whole point of warming is
     * that the load completes before the tap.
     */
    fun pause() {
        if (paused) return
        paused = true
        view.onPause()
    }

    /** Undoes [pause]. Called before the view is handed to a sheet, and before any re-load. */
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
 * Builds the sheet's WebView. No visible URL bar, so a cross-origin navigation would be
 * indistinguishable from trusted content — hence the origin pinning and no JS bridge below. No
 * service-worker offline shell for a never-before-visited sheet; [SharingWebViewClient] covers
 * the previously-visited case via a cache-only retry.
 *
 * Returns unbound: nothing is reported until [SharingWebViewHandle.bind] names a session.
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

            // Transparent, not the default opaque white. The sheet presents this view
            // rectangularly on purpose — a rounded clip cannot be handed to the WebView draw
            // functor, whose ABI carries a rect clip only, so HWUI would route every frame
            // through an offscreen pass to honour it. The page rounds its own top corners
            // instead (`cornerRadius` in [SharingPageUrl]), and those corners can only cut
            // through to the scrim if this view is not painting a background behind them.
            //
            // Costs some of Blink's opaque-surface fast paths. That is a fixed cost against a
            // per-frame, full-surface stencil pass.
            setBackgroundColor(Color.TRANSPARENT)

            // No touch interception dance here any more. The sheet presents with
            // `sheetGesturesEnabled = false`, so nothing upstream competes for a vertical drag
            // and the page's own scroll container gets every gesture that lands on it. The
            // sheet is dragged from `SharingSheetGrabStrip`, which is a Compose hit target
            // above this view and therefore never reaches it.

            // Third-party cookies off. Android has no per-WebView data store, so first-party wallet
            // cookies outlive the sheet regardless; clearing on dismiss isn't an option either,
            // since that API is app-global.
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)

            webViewClient = client
        }
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

    /**
     * Whether the navigation in flight was started under the current binding.
     *
     * A pooled view is bound mid-flight — the warm load is usually still running when the user
     * taps. Its `onPageFinished` would otherwise read as the *session's* page settling, which
     * cancels the tier-3 deadline and lifts the skeleton onto the warm page; its
     * `onReceivedError` would read as the session's page failing and fire the native share
     * fallback. Cleared on bind, set by the next [onPageStarted].
     */
    private var navigationOwnedByBinding = false

    /** Main-frame URL currently in flight, captured in [onPageStarted]; null once resolved. */
    private var pendingMainFrameUrl: String? = null

    /** At most one cache-only retry per binding. */
    private var retried = false

    /**
     * True between issuing the cache-only retry and it starting. Without this, a duplicate
     * error callback for the same failure would look like the retry itself failing and reset
     * cacheMode before the retry's own loadUrl dispatches. [onPageStarted] clears it.
     */
    private var retryPending = false

    /** Set once [SharingWebViewBinding.onLoadFailed] fires, so it fires at most once per binding. */
    private var settled = false

    /**
     * Set when the in-flight main-frame navigation reports an error. Android still fires
     * [onPageFinished] for its own error page, which without this flag would read as a
     * successful load and cancel the tier-3 deadline.
     */
    private var navigationFailed = false

    /** Distinguishes one [WebView.postVisualStateCallback] request from a stale earlier one. */
    private var visualStateRequest = 0L

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
            // `sid` guards against a result from a sheet the user already closed, and against
            // one from the warm page, whose session id no sheet can ever hold.
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
        // The warm load landing after this view was lent to a sheet. Not this session's page.
        if (!navigationOwnedByBinding) return
        // Android delivers this for its own error page too, in the same load cycle as the
        // failure. Reporting readiness here would kill the tier-3 fallback.
        if (navigationFailed) return
        // `retried` is NOT reset: one retry per binding for the sheet's whole lifetime.
        pendingMainFrameUrl = null
        view.settings.cacheMode = WebSettings.LOAD_DEFAULT // undo handleMainFrameFailure's cache-only mode
        val settledBinding = binding
        settledBinding.onPageReady()

        // Document-finished is not painted: React renders after `load`, and lifting the
        // skeleton here would expose a blank white rectangle — the flash this exists to close.
        // postVisualStateCallback fires once the DOM as of this moment is actually drawable.
        val request = ++visualStateRequest
        view.postVisualStateCallback(
            request,
            object : WebView.VisualStateCallback() {
                override fun onComplete(requestId: Long) {
                    // A newer navigation (a `confirmed=1` reload, the install page) already
                    // superseded this one; its own callback owns visibility.
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
        // The warm load failing after this view was lent to a sheet. Falling back here would
        // raise a native chooser over a sheet whose own page hasn't been tried yet.
        if (!navigationOwnedByBinding) return
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
        // Recovery would mean reloading the content that just crashed a process; tier 3 already
        // has a working locally-built link.
        if (!settled) {
            settled = true
            binding.onLoadFailed()
        }
        return true
    }
}
