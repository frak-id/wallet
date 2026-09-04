package id.frak.sdk.ui

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * One session's outcome ledger: a session can produce several results, and the merchant gets the
 * most significant one, exactly once.
 *
 * Deliberately not thread-safe. Every caller reaches it on [SharingSheetState]'s own dispatcher —
 * see that class's note on confinement. iOS's `AttributionLedger` is the same idea under `@MainActor`.
 */
internal class SharingOutcome(
    /** The host's scope, not the sheet's: work started here must outlive the sheet that started it. */
    private val scope: CoroutineScope,
    private val report: (SharingResult) -> Unit,
) {
    private var best: SharingResult? = null

    /** Outcome-deciding coroutines still running; [abandon] must not report over them. */
    private var inFlight = 0

    /** Set by [abandon] when it had to defer to [inFlight]. */
    private var abandonRequested = false

    var isFinished: Boolean = false
        private set

    /** Keeps the most significant outcome seen so far, without reporting it. */
    fun record(result: SharingResult) {
        val current = best
        if (current == null || result.significance > current.significance) best = result
    }

    /** Reports once. Later calls are no-ops, whatever they carry. */
    fun finish(result: SharingResult) {
        if (isFinished) return
        isFinished = true
        record(result)
        report(best ?: result)
    }

    /**
     * The sheet went away with no explicit outcome, reported as a dismissal. Defers to [launch] so
     * it cannot beat a real outcome that is still resolving.
     */
    fun abandon() {
        abandonRequested = true
        if (inFlight == 0) finish(SharingResult.Dismissed)
    }

    /**
     * Launches work that decides or records this session's outcome, tracked so [abandon] can wait
     * for it. Everything ending in a [record] or a [finish] has to go through here.
     */
    fun launch(block: suspend () -> Unit) {
        // Incremented before the launch: `abandon` could otherwise run between the two and report
        // over work that is about to start.
        inFlight++
        scope.launch {
            try {
                block()
            } finally {
                // Only ever supplies the dismissal `abandon` deferred; `finish` no-ops if the block
                // already reported one.
                if (--inFlight == 0 && abandonRequested) finish(SharingResult.Dismissed)
            }
        }
    }
}
