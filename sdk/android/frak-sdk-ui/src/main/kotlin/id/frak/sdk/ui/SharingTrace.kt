package id.frak.sdk.ui

import android.os.SystemClock
import android.util.Log

/**
 * Tap-to-paint timings for one sheet, off unless the tag is enabled with
 * `adb shell setprop log.tag.FrakSharing DEBUG`.
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
