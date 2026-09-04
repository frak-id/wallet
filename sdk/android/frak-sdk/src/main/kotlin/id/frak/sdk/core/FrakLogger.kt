package id.frak.sdk.core

import android.util.Log

/**
 * Level-gated logcat wrapper. Routing is exclusive: when [sink] is set, gated messages go to it
 * instead of logcat, never both. A sink that throws is swallowed, never propagated or re-logged.
 */
internal class FrakLogger(
    private val level: FrakLogLevel,
    private val sink: FrakLogSink? = null,
) {
    fun error(
        message: String,
        throwable: Throwable? = null,
    ): Unit = log(FrakLogLevel.ERROR, message, throwable)

    fun warn(
        message: String,
        throwable: Throwable? = null,
    ): Unit = log(FrakLogLevel.WARN, message, throwable)

    fun info(message: String): Unit = log(FrakLogLevel.INFO, message, null)

    fun debug(message: String): Unit = log(FrakLogLevel.DEBUG, message, null)

    private fun log(
        at: FrakLogLevel,
        message: String,
        throwable: Throwable?,
    ) {
        // Relies on FrakLogLevel's declaration order (NONE < ERROR < WARN < INFO < DEBUG) as severity.
        if (level.ordinal < at.ordinal) return
        if (sink != null) {
            try {
                sink.log(at, message, throwable)
            } catch (_: Throwable) {
                // Swallowed: a merchant's sink must never crash this SDK's host.
            }
            return
        }
        when (at) {
            FrakLogLevel.ERROR -> Log.e(TAG, message, throwable)
            FrakLogLevel.WARN -> Log.w(TAG, message, throwable)
            FrakLogLevel.INFO -> Log.i(TAG, message)
            FrakLogLevel.DEBUG -> Log.d(TAG, message)
            FrakLogLevel.NONE -> Unit
        }
    }

    private companion object {
        const val TAG = "Frak"
    }
}
