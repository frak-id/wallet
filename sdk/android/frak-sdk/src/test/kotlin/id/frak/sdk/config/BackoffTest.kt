package id.frak.sdk.config

import id.frak.sdk.core.FrakError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/**
 * Pins the failure-backoff policy.
 *
 * The clock and the RNG are both injected so these assert an exact schedule
 * rather than sleeping. A backoff test that sleeps is a backoff test nobody runs.
 */
class BackoffTest {
    /** Draws the top of the jitter range, so delays are exact and assertable. */
    private class MaxJitter : Random() {
        override fun nextBits(bitCount: Int): Int = throw UnsupportedOperationException()

        override fun nextLong(until: Long): Long = until - 1
    }

    private var clock = 0L
    private val backoff = Backoff(now = { clock }, random = MaxJitter())

    @Test
    fun `a fresh key is not backing off`() {
        assertFalse(backoff.isBackingOff("k"))
    }

    @Test
    fun `one failure arms a window of at least the minimum delay`() {
        backoff.recordFailure("k", null)

        assertTrue("still backing off immediately after", backoff.isBackingOff("k"))
        clock += Backoff.MIN_DELAY_MILLIS
        assertFalse("window has passed", backoff.isBackingOff("k"))
    }

    @Test
    fun `delay grows exponentially with consecutive failures`() {
        val delays =
            (1..4).map {
                clock = 0
                repeat(it) { backoff.recordFailure("k", null) }
                measureWindow("k")
            }

        // 1s, 2s, 4s, 8s at the top of the jitter range. Doubling is what stops
        // the SDK hammering a dead network at 1Hz for as long as the user stays
        // on the screen — the JS fixed 1s does exactly that.
        assertEquals(listOf(1_000L, 2_000L, 4_000L, 8_000L), delays)
    }

    @Test
    fun `delay is capped`() {
        repeat(20) { backoff.recordFailure("k", null) }

        assertEquals(Backoff.MAX_DELAY_MILLIS, measureWindow("k"))
    }

    @Test
    fun `a Retry-After acts as a floor, not a replacement`() {
        // The backend knows its own rate limit better than we do.
        backoff.recordFailure("k", FrakError.Server(429, null, retryAfterSeconds = 30))

        assertEquals(30_000L, measureWindow("k"))
    }

    @Test
    fun `our own exponential wins once it exceeds the server floor`() {
        // A small Retry-After must not pin us to it while we keep failing.
        repeat(6) { backoff.recordFailure("k", FrakError.Server(429, null, retryAfterSeconds = 2)) }

        assertTrue("exponential should have overtaken the 2s floor", measureWindow("k") > 2_000L)
    }

    @Test
    fun `success clears the window`() {
        backoff.recordFailure("k", null)
        backoff.recordSuccess("k")

        assertFalse(backoff.isBackingOff("k"))
    }

    @Test
    fun `success resets the exponential rather than merely clearing it`() {
        repeat(5) { backoff.recordFailure("k", null) }
        backoff.recordSuccess("k")
        clock = 0
        backoff.recordFailure("k", null)

        // Back to the floor. Without a reset, a key that fails once an hour
        // would eventually sit at the cap forever.
        assertEquals(Backoff.MIN_DELAY_MILLIS, measureWindow("k"))
    }

    @Test
    fun `keys back off independently`() {
        backoff.recordFailure("a", null)

        assertTrue(backoff.isBackingOff("a"))
        assertFalse("an unrelated key is unaffected", backoff.isBackingOff("b"))
    }

    @Test
    fun `jitter halves the floor rather than smearing around the delay`() {
        // Full jitter draws over [delay/2, delay] to decorrelate devices that
        // all failed at the same instant; a narrow band around a common value
        // would leave a fleet-wide stampede intact, just slightly smeared.
        val zeroJitter =
            Backoff(
                now = { clock },
                random =
                    object : Random() {
                        override fun nextBits(bitCount: Int): Int = throw UnsupportedOperationException()

                        override fun nextLong(until: Long): Long = 0
                    },
            )
        zeroJitter.recordFailure("k", null)

        clock = Backoff.MIN_DELAY_MILLIS / 2
        assertFalse("the lower bound of the jitter range is half the delay", zeroJitter.isBackingOff("k"))
    }

    /** Advances the clock until [key] stops backing off, and returns the elapsed time. */
    private fun measureWindow(key: String): Long {
        val start = clock
        while (backoff.isBackingOff(key)) clock += 1
        return clock - start
    }
}
