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

    /** Whether the next [acquire] will get the warm view rather than a cold one. Diagnostic; see [SharingTrace]. */
    val hasWarmView: Boolean get() = pooled != null && !lent

    /**
     * Boots the pooled view. Cheap to call repeatedly; only the first does work.
     *
     * The warm load carries `native=1` so the page takes its chromeless path and skips wallet
     * identity resolution — a warm-up must not mint client-side state for a session that may
     * never happen. It carries no merchantId, so the page itself won't render; the point is the
     * document, bundle, CSS and fonts landing in the HTTP cache with V8 already warm.
     */
    fun warm() {
        if (!preload) return
        if (pooled != null) return
        val trace = SharingTrace()
        trace.mark("warm load starting")
        pooled =
            newHandle().also { handle ->
                // Bound rather than left on the shared default so the warm load's own
                // milestones are traceable: whether it even finished before the user tapped
                // is the difference between preloading working and preloading being a no-op.
                handle.bind(
                    SharingWebViewBinding(
                        sessionId = SharingWebViewBinding.WARM_SESSION_ID,
                        onPageReady = { trace.mark("warm document finished") },
                        onPageVisible = { trace.mark("warm first paint") },
                        onLoadFailed = { trace.mark("warm load FAILED") },
                    ),
                )
                handle.load(warmUrl)
            }
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
        // The warm load is usually still in flight at tap time. Stopping it keeps it from
        // racing the session's own navigation for the network; the client ignores its
        // callbacks either way (see SharingWebViewClient.navigationOwnedByBinding).
        reused.view.stopLoading()
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
     */
    fun release(handle: SharingWebViewHandle) {
        if (handle !== pooled) {
            handle.view.removeFromParent()
            handle.destroy()
            return
        }
        lent = false
        handle.view.removeFromParent()
        handle.bind(SharingWebViewBinding.Warm)
        handle.view.stopLoading()
        handle.load(warmUrl)
    }

    /** Drops the pooled view when the share surface leaves the screen; its timers and context go with it. */
    fun destroy() {
        val handle = pooled ?: return
        pooled = null
        lent = false
        handle.view.removeFromParent()
        handle.destroy()
    }

    /** The URL a view sits on while nobody is looking at it. */
    private val warmUrl: String
        get() = "$walletOrigin/sharing?native=1&sid=${SharingWebViewBinding.WARM_SESSION_ID}"

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
 */
@Composable
internal fun rememberSharingWebViewPool(): SharingWebViewPool? {
    if (!Frak.isInitialized) return null
    val walletOrigin = Frak.client.environment.wallet
    val preload = Frak.preloadSharing
    val context = LocalContext.current

    val pool = remember(context, walletOrigin, preload) { SharingWebViewPool(context, walletOrigin, preload) }
    DisposableEffect(pool) {
        pool.warm()
        onDispose(pool::destroy)
    }
    return pool
}
