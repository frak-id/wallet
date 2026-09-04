package id.frak.sdk.net

import id.frak.sdk.core.FrakLogger
import java.util.concurrent.atomic.AtomicBoolean

/**
 * The backend's clock, learned from the `Date` header of any response, for stamping identity
 * proofs. The backend rejects a proof more than 60 s in its future, and a merge proof outside a
 * 10-minute window, so an unsynchronised device clock invalidates every signature it makes. The
 * future bound is the tight one: widening the merge window only bought slack on the past side.
 */
internal class ServerClock(
    private val wallClock: () -> Long = System::currentTimeMillis,
    private val logger: FrakLogger? = null,
) {
    /** Written from any response thread, read from the signing path. */
    @Volatile
    private var offsetMillis: Long = 0

    private val warned = AtomicBoolean(false)

    fun nowMillis(): Long = wallClock() + offsetMillis

    fun nowSeconds(): Long = nowMillis() / 1000

    /** [serverMillis] of 0 means the header was absent or unparseable — `getHeaderFieldDate`'s own default. */
    fun observe(serverMillis: Long) {
        // A garbage `Date` would skew every proof this device signs, so only a date that could
        // plausibly be now is trusted. The origin is ours over TLS; this guards a broken proxy.
        if (serverMillis < EARLIEST_PLAUSIBLE_MILLIS) return
        if (serverMillis > LATEST_PLAUSIBLE_MILLIS) return
        val offset = serverMillis - wallClock()
        offsetMillis = offset
        if (offset > -DRIFT_WARN_MILLIS && offset < DRIFT_WARN_MILLIS) return
        if (!warned.compareAndSet(false, true)) return
        logger?.warn(
            "This device's clock is ${offset / 1000}s from the server's. " +
                "Proof timestamps are corrected, but check the device's date settings.",
        )
    }

    private companion object {
        /** Half the tightest server window, so a warning fires well before signatures start failing. */
        const val DRIFT_WARN_MILLIS = 30_000L

        /** 2025-01-01. Anything below is a broken header, not a clock this SDK should adopt. */
        const val EARLIEST_PLAUSIBLE_MILLIS = 1_735_689_600_000L

        /** 2100-01-01. A far-future `Date` is as broken as a far-past one, and skews proofs the way the server actually rejects. */
        const val LATEST_PLAUSIBLE_MILLIS = 4_102_444_800_000L
    }
}
