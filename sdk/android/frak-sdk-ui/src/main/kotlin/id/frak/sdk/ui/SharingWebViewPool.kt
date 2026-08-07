package id.frak.sdk.ui

import android.content.Context
import android.view.ViewGroup

/**
 * Holds one sharing `WebView` for as long as its hosting screen is alive, so presenting a sheet
 * costs a navigation rather than engine startup. Driven by [SharingHost.warm], which is the only
 * control: an explicit `warm()` always warms. [context] must be [SharingHost]'s
 * `MutableContextWrapper`: a `WebView` keeps a hard reference to its construction context.
 */
internal class SharingWebViewPool(
    private val context: Context,
    private val walletOrigin: String,
) {
    private var pooled: SharingWebViewHandle? = null

    /** True while [pooled] is inside a sheet, so [destroy] knows not to pull it out from under one. */
    private var lent = false

    /** The view [acquire] would hand out, or null when the next sheet gets a cold one. */
    val warmHandle: SharingWebViewHandle? get() = pooled?.takeIf { !lent }

    val hasWarmView: Boolean get() = warmHandle != null

    private var warmUrl: String? = null

    private var destroyed = false

    /**
     * Boots the pooled view against [url] — the real merchant page, whose `state=warm` keeps it from
     * reporting itself as viewed. Cheap to call repeatedly; only a change of URL does work.
     */
    fun warm(url: String) {
        if (destroyed) return
        if (warmUrl == url) return
        warmUrl = url
        val trace = SharingTrace()
        trace.mark("warm load starting")
        val handle = pooled ?: newHandle().also { pooled = it }
        // Bound rather than left on the shared default, so the warm load's milestones are traceable.
        handle.bind(
            SharingWebViewBinding(
                sessionId = SharingWebViewBinding.WARM_SESSION_ID,
                onPageReady = {
                    // Gates fragment activation — see SharingWebViewHandle.documentReady.
                    handle.onDocumentReady()
                    // Nobody is looking at this document until a tap.
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
     * The view the sheet should present, already bound to [binding]. Detached from any previous
     * parent first: a reopened sheet can race Compose's own removal, and re-parenting throws.
     */
    fun acquire(binding: SharingWebViewBinding): SharingWebViewHandle {
        val reused = pooled
        if (reused == null || lent) return newHandle().also { it.bind(binding) }
        lent = true
        reused.view.removeFromParent()
        // Undoes the pause `warm` applied, before the caller navigates.
        reused.resume()
        // Only stop a load that cannot be salvaged: an unfinished one would race the full load.
        if (!reused.documentReady) reused.view.stopLoading()
        reused.bind(binding)
        return reused
    }

    /**
     * Takes the view back when a sheet closes: rebound to [SharingWebViewBinding.Warm] so a late
     * navigation reports nowhere, and re-warmed with a full navigation, since only a fresh document
     * reliably undoes the mid-flow page the closed session left behind.
     */
    fun release(handle: SharingWebViewHandle) {
        // Not ours, or ours but the surface has gone away underneath it: this view has no future.
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
        // Re-warm rather than just reload: `warm` is what rebinds the readiness callback. Cleared
        // first so `warm` does not short-circuit on an unchanged URL.
        warmUrl = null
        if (url != null) {
            warm(url)
        } else {
            // Never warmed: just make sure a late navigation reports nowhere.
            handle.bind(SharingWebViewBinding.Warm)
        }
    }

    /**
     * Drops the pooled view when the hosting screen is really gone (the `ViewModelStore` cleared,
     * not an Activity destroyed by a rotation). Never pulled out of a sheet that is still using it,
     * since destroying a live WebView crashes it: the pool marks itself dead and [release] destroys.
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

    /**
     * Builds a view against [context], the `MutableContextWrapper` [SharingHost] keeps pointed at
     * the current Activity: a `WebView` resolves theme, inflater and popup host at construction.
     */
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
