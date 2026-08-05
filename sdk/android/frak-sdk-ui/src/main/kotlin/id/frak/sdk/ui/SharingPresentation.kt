package id.frak.sdk.ui

import android.content.Context
import id.frak.sdk.sharing.SharingRequest
import kotlinx.coroutines.CoroutineScope
import java.util.UUID

/**
 * One sharing session, started at the tap rather than at the sheet's first composition.
 *
 * This exists because of what the sheet's composition costs. `ModalBottomSheet` builds a real
 * Dialog with its own Window and surface, and the pooled web view is attached and laid out in the
 * same frames — Main is occupied for ~300ms. Anything sequenced *inside* that composition queues
 * behind it, which is where the session build and then the navigation each lost their turn.
 *
 * [start] is called from [FrakSharingLauncher.launch], i.e. on the merchant's click handler, while
 * Main is still idle. The build runs off-thread and the page load goes out as an ordinary main-loop
 * message, so the document is already in flight while the sheet is still animating in. The sheet
 * then renders a session that is already underway rather than starting one.
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
     * Releases a session that finished before any sheet composed it.
     *
     * Reachable: `build()` can hit the tier-3 fallback and report a terminal result off-thread,
     * before the first frame. Without this the pooled view stays lent for the life of the process
     * and every later sheet silently falls back to a cold one.
     */
    fun disposeIfUnpresented() {
        if (!presented) dispose()
    }

    /** Idempotent — the sheet's `onDispose` and [disposeIfUnpresented] can both reach it. */
    fun dispose() {
        if (disposed) return
        disposed = true
        // Before the view goes back to the pool, and unconditionally: this is the only place that
        // catches a sheet leaving composition without an explicit outcome — a configuration change,
        // a nav-graph pop, the merchant's screen being replaced. None of those route through
        // `dismiss()`, so without this the merchant's `onResult` is never called for that session
        // at all. `abandon()` no-ops once anything terminal has already been reported, and reports
        // the most significant outcome the session reached when it has not.
        state.abandon()
        state.release()
        pool.release(handle)
    }

    companion object {
        /** Fallback threshold: past this, skip the page and fire the native share sheet directly. */
        private const val PAGE_LOAD_DEADLINE_MILLIS = 1_500L

        fun start(
            pool: SharingWebViewPool,
            context: Context,
            scope: CoroutineScope,
            request: SharingRequest,
            onFinished: (SharingResult) -> Unit,
        ): SharingPresentation {
            val trace = SharingTrace()
            val sessionId = UUID.randomUUID().toString()

            // Taken before the state exists, because whether this view is a finished warm page
            // decides how the session navigates — and the state needs that answer at
            // construction. Bound here only by session id, which is already enough to make the
            // client reject a late callback from the sheet that closed before this one.
            val handle = pool.acquire(SharingWebViewBinding(sessionId = sessionId))

            // A fragment activation is only same-document if the document is actually there.
            // Warming is usually still in flight at tap, and hanging a fragment off a half-
            // loaded page would strand it: nothing would ever finish the load.
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
                    // The launcher's scope, not the sheet's: an in-flight track() or share()
                    // outlives the sheet that started it, and the build must survive the sheet
                    // being recomposed.
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

            // Attach before prepare: whichever finishes second issues the navigation, and the
            // view is ready long before the build can be.
            state.attach(handle.view)
            state.prepare(request)
            // Budget starts at the tap, which is what it was always meant to bound.
            state.startLoadDeadline(PAGE_LOAD_DEADLINE_MILLIS)

            return SharingPresentation(state = state, handle = handle, pool = pool)
        }
    }
}
