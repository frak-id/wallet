package id.frak.sdk.ui

import android.os.SystemClock
import android.util.Log

/**
 * Tap-to-paint timings for one sheet.
 *
 * Off unless the tag is turned on, which costs a property lookup per milestone and nothing
 * else — so it ships enabled-able rather than stripped, since the numbers that matter can only
 * be taken on a real device against the real wallet:
 *
 * ```
 * adb shell setprop log.tag.FrakSharing DEBUG
 * adb logcat -s FrakSharing
 * ```
 *
 * Deliberately not routed through `FrakConfig.logSink`: `FrakLogger` is `internal` to
 * `:frak-sdk` and Kotlin `internal` is per-compilation-unit, so `:frak-sdk-ui` cannot reach it
 * without widening the published API for a diagnostic.
 */
internal class SharingTrace {
    private val startedAt = SystemClock.elapsedRealtime()
    private var previousAt = startedAt

    fun mark(event: String) {
        val now = SystemClock.elapsedRealtime()
        val sincePrevious = now - previousAt
        previousAt = now
        if (!Log.isLoggable(TAG, Log.DEBUG)) return
        Log.d(TAG, "$event — ${now - startedAt}ms since launch (+${sincePrevious}ms)")
    }

    private companion object {
        const val TAG = "FrakSharing"
    }
}
