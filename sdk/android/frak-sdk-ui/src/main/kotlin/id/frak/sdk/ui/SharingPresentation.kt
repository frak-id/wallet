package id.frak.sdk.ui

import android.content.Context
import id.frak.sdk.sharing.SharingRequest
import kotlinx.coroutines.CoroutineScope
import java.util.UUID

/**
 * One sharing session, started at the tap rather than at the sheet's first composition: showing
 * the dialog and attaching the web view occupy Main for ~300ms, and anything sequenced inside that
 * queues behind it. [start] runs from the merchant's click handler while Main is still idle, so
 * the document is already in flight while the sheet animates in.
 */
internal class SharingPresentation(
    val state: SharingSheetState,
    val handle: SharingWebViewHandle,
    private val pool: SharingWebViewPool,
) {
    private var presented = false
    private var disposed = false

    /** The sheet has taken ownership; its own disposal now drives [dispose]. */
    fun onPresented() {
        presented = true
    }

    /**
     * Releases a session that finished before any sheet composed it — `build()` can report a
     * terminal result off-thread before the first frame, which would otherwise leak the pooled view.
     */
    fun disposeIfUnpresented() {
        if (!presented) dispose()
    }

    /**
     * Takes the web view out of the view tree without ending the session, which is what a
     * configuration change needs: adding a still-parented child to the next dialog throws.
     */
    fun detachView() {
        (handle.view.parent as? android.view.ViewGroup)?.removeView(handle.view)
    }

    /** Idempotent — [SharingHost] and [disposeIfUnpresented] can both reach it. */
    fun dispose() {
        if (disposed) return
        disposed = true
        // The only place that catches a sheet going away without an explicit outcome (Activity
        // destroyed, screen replaced); `abandon()` no-ops once anything terminal was reported.
        state.abandon()
        state.release()
        pool.release(handle)
    }

    companion object {
        /**
         * Fallback threshold: past this, skip the page and fire the native share sheet directly.
         *
         * Covers build, navigation, load and first paint together, and has to fit the *slowest*
         * path: activation needs a finished warm document, which usually is not ready at the tap,
         * so the common case is a full load plus a build. See `07-sharing-sheet-audit.md` §2.6.
         */
        private const val PAGE_LOAD_DEADLINE_MILLIS = 5_000L

        fun start(
            pool: SharingWebViewPool,
            context: Context,
            scope: CoroutineScope,
            request: SharingRequest,
            onFinished: (SharingResult) -> Unit,
        ): SharingPresentation {
            val trace = SharingTrace()
            val sessionId = UUID.randomUUID().toString()

            // Taken before the state exists: whether this view is a finished warm page decides how
            // the session navigates, and the state needs that answer at construction.
            val handle = pool.acquire(SharingWebViewBinding(sessionId = sessionId))

            // A fragment activation is only same-document if the document is actually there;
            // hanging one off a half-loaded page would strand the load.
            val activationBaseUrl = handle.loadedBaseUrl?.takeIf { handle.documentReady }
            trace.mark(
                when {
                    activationBaseUrl != null -> "launch (warm view, ACTIVATING)"
                    pool.hasWarmView -> "launch (warm view, still loading)"
                    else -> "launch (COLD view)"
                },
            )

            val state =
                SharingSheetState(
                    // The host's scope, not the sheet's: an in-flight track() or share() outlives
                    // the sheet that started it.
                    scope = scope,
                    context = context,
                    sessionId = sessionId,
                    onFinished = onFinished,
                    trace = trace,
                    activationBaseUrl = activationBaseUrl,
                )

            handle.bind(
                SharingWebViewBinding(
                    sessionId = sessionId,
                    onAction = state::onPageAction,
                    onPageReady = {
                        trace.mark("document finished")
                        state.onPageReady()
                    },
                    onPageVisible = {
                        trace.mark("first paint")
                        state.onPageVisible()
                    },
                    onLoadFailed = {
                        trace.mark("load FAILED")
                        state.onPageUnavailable()
                    },
                    onOpenExternal = state::openExternally,
                ),
            )

            // Attach before prepare: whichever finishes second issues the navigation.
            state.attach(handle.view)
            state.prepare(request)
            // Budget starts at the tap.
            state.startLoadDeadline(PAGE_LOAD_DEADLINE_MILLIS)

            return SharingPresentation(state = state, handle = handle, pool = pool)
        }
    }
}
