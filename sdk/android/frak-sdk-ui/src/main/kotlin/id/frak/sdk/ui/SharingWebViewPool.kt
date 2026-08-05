package id.frak.sdk.ui

import android.content.Context
import android.view.ViewGroup
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import id.frak.sdk.Frak

/**
 * Holds one sharing `WebView` for as long as a share surface is on screen.
 *
 * Gated behind [id.frak.sdk.core.FrakConfig.preloadSharing]. With it off this is a plain
 * factory — a fresh view per sheet, destroyed with it, which is what the SDK has always done.
 * With it on, one view is booted against the wallet origin the moment the surface appears and
 * then handed to the sheet itself, so presenting costs a navigation rather than engine startup,
 * TLS, the React bundle and a V8 warm-up.
 *
 * One view per pool, so hoist [rememberFrakSharingLauncher] per screen, not per row.
 * [FrakSharingLauncher] already refuses a second concurrent sheet, so the single view can never
 * be wanted twice at once.
 */
internal class SharingWebViewPool(
    private val context: Context,
    private val walletOrigin: String,
    private val preload: Boolean,
) {
    private var pooled: SharingWebViewHandle? = null

    /** True while [pooled] is inside a sheet, so [destroy] knows not to pull it out from under one. */
    private var lent = false

    /**
     * The view [acquire] would hand out, or null when the next sheet gets a cold one.
     *
     * Exposed so a caller can ask what state the warm-up reached — [SharingWebViewHandle.documentReady]
     * is what decides whether a session may activate on top of it rather than load the page again.
     */
    val warmHandle: SharingWebViewHandle? get() = pooled?.takeIf { !lent }

    /** Whether the next [acquire] will get the warm view rather than a cold one. Diagnostic; see [SharingTrace]. */
    val hasWarmView: Boolean get() = warmHandle != null

    /** The URL [warm] last booted the pooled view on, so a session can tell whether it may activate on top of it. */
    private var warmUrl: String? = null

    /** Set by [destroy]. A pool whose surface has gone must not warm again, and must destroy on release. */
    private var destroyed = false

    /**
     * Boots the pooled view against [url]. Cheap to call repeatedly; only a change of URL does
     * work.
     *
     * [url] is the *real* merchant page (see [SharingPageUrl.warm]), not a neutral one: the
     * bundle, i18n and both merchant-keyed queries are the expensive part, and none of them can
     * start without a merchantId. `state=warm` in that URL is what keeps the page from reporting
     * itself as viewed while it sits here unseen.
     *
     * Called once the merchant config resolves rather than at composition, which is why this
     * takes a URL instead of building one — the identity simply is not known any earlier.
     */
    fun warm(url: String) {
        if (!preload) return
        if (destroyed) return
        if (warmUrl == url) return
        warmUrl = url
        val trace = SharingTrace()
        trace.mark("warm load starting")
        val handle = pooled ?: newHandle().also { pooled = it }
        // Bound rather than left on the shared default so the warm load's own milestones are
        // traceable: whether it even finished before the user tapped is the difference between
        // preloading working and preloading being a no-op.
        handle.bind(
            SharingWebViewBinding(
                sessionId = SharingWebViewBinding.WARM_SESSION_ID,
                onPageReady = {
                    // Gates fragment activation — see SharingWebViewHandle.documentReady.
                    handle.onDocumentReady()
                    // Nobody is looking at this document and nobody will until a tap. See
                    // SharingWebViewHandle.pause for exactly how much that saves — less than the
                    // name suggests, since it does not stop the page's JavaScript.
                    handle.pause()
                    trace.mark("warm document finished")
                },
                onPageVisible = { trace.mark("warm first paint") },
                onLoadFailed = { trace.mark("warm load FAILED") },
            ),
        )
        // A re-warm after a sheet closed lands on a view this pool paused on its previous cycle.
        handle.resume()
        handle.load(url)
    }

    /**
     * The view the sheet should present, already bound to [binding].
     *
     * Detaches from any previous parent first: Compose removes the view when an `AndroidView`
     * leaves composition, but a torn-down-and-immediately-reopened sheet can race that, and
     * adding a still-parented child throws.
     */
    fun acquire(binding: SharingWebViewBinding): SharingWebViewHandle {
        val reused = if (preload) pooled else null
        if (reused == null || lent) return newHandle().also { it.bind(binding) }
        lent = true
        reused.view.removeFromParent()
        // Undoes the pause `warm` applied when the document finished. Before the binding and
        // before the caller navigates, so the session's own load or fragment activation runs on a
        // view that is already awake.
        reused.resume()
        // Only stop a load that cannot be salvaged. A finished warm document is what the
        // session activates on top of, and stopLoading() on a finished page is a no-op anyway;
        // an unfinished one is going to be replaced by a full load, and stopping it keeps it
        // from racing that for the network. The client ignores its callbacks either way (see
        // SharingWebViewClient.navigationOwnedByBinding).
        if (!reused.documentReady) reused.view.stopLoading()
        reused.bind(binding)
        return reused
    }

    /**
     * Takes the view back when a sheet closes.
     *
     * The pooled view is reset rather than destroyed: rebound to [SharingWebViewBinding.Warm] so
     * a late navigation from the closed session reports nowhere, and sent back to the warm URL
     * so the next sheet neither inherits the last one's confirmation screen nor pays for a cold
     * bundle. The sheet's skeleton covers the stale frame either way.
     *
     * Reloading the warm URL is a full navigation on purpose, even though the session that just
     * ended reached it by fragment. The page it leaves behind is mid-flow — a confirmation
     * screen, an install page, a toast — and only a fresh document reliably undoes all of that.
     */
    fun release(handle: SharingWebViewHandle) {
        // Not ours, or ours but the surface has gone away underneath it — either way this view has
        // no future, and [destroy] deliberately left it to the sheet that was still driving it.
        if (handle !== pooled || destroyed) {
            if (handle === pooled) {
                pooled = null
                warmUrl = null
            }
            lent = false
            handle.view.removeFromParent()
            handle.destroy()
            return
        }
        lent = false
        handle.view.removeFromParent()
        handle.view.stopLoading()
        val url = warmUrl
        // Re-warm rather than just reload: `warm` is what rebinds the readiness callback, and
        // without it `documentReady` would never come back and every later sheet would decide
        // it cannot activate. Cleared first so `warm` does not short-circuit on an unchanged URL.
        warmUrl = null
        if (url != null) {
            warm(url)
        } else {
            // Never warmed (preload off, or config never resolved): nothing to return it to,
            // so just make sure a late navigation from the closed session reports nowhere.
            handle.bind(SharingWebViewBinding.Warm)
        }
    }

    /**
     * Drops the pooled view when the share surface leaves the screen; its timers and context go
     * with it.
     *
     * Will not pull the view out of a sheet that is still using it. Compose disposes inner effects
     * first, so the sheet normally hands it back before this runs — but "normally" is not an
     * invariant, and destroying a WebView a live sheet is still driving crashes it. In that case
     * the pool marks itself dead and [release] does the destroying, so the view is never leaked
     * either.
     */
    fun destroy() {
        destroyed = true
        if (lent) return
        val handle = pooled ?: return
        pooled = null
        warmUrl = null
        handle.view.removeFromParent()
        handle.destroy()
    }

    private fun newHandle(): SharingWebViewHandle =
        createSharingWebView(
            context = context,
            walletOrigin = walletOrigin,
            returnScheme = SharingPageUrl.returnScheme(context.packageName),
        )
}

/** `WebView.destroy` and any re-parenting both require the view to be out of the tree first. */
private fun android.view.View.removeFromParent() {
    (parent as? ViewGroup)?.removeView(this)
}

/**
 * Remembers the share surface's [SharingWebViewPool], or null before [id.frak.sdk.Frak.initialize].
 *
 * Deliberately holds the *activity* context, not the application one: the pooled view is scoped
 * to this composition and dies with it, and a WebView needs a themed, windowed context for its
 * own popups (select dropdowns, text selection handles) to place themselves correctly.
 *
 * Warming is not started here. The URL worth warming carries the real merchantId, which does not
 * exist until the config resolves — [WarmSharingData] owns that and calls [SharingWebViewPool.warm]
 * when it lands.
 */
@Composable
internal fun rememberSharingWebViewPool(): SharingWebViewPool? {
    if (!Frak.isInitialized) return null
    val walletOrigin = Frak.client.environment.wallet
    val preload = Frak.preloadSharing
    val context = LocalContext.current

    val pool = remember(context, walletOrigin, preload) { SharingWebViewPool(context, walletOrigin, preload) }
    DisposableEffect(pool) { onDispose(pool::destroy) }
    return pool
}
