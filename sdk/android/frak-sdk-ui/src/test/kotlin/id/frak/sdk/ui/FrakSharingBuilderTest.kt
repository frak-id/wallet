package id.frak.sdk.ui

import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Test

/**
 * [FrakSharing.Builder]'s own contract, which needs no Activity and therefore no Robolectric —
 * everything up to `build(...)` is plain Kotlin.
 *
 * `build(...)` itself is not covered here. It resolves a `SharingHost`, which registers a
 * lifecycle observer and eventually opens a real `ComponentDialog` with a composition inside it;
 * that needs an instrumented run, not a JVM unit test. The decisions it makes before it gets that
 * far are pinned in [SharingPresentDecisionTest].
 */
class FrakSharingBuilderTest {
    private fun builder() = FrakSharing.Builder { }

    @Test
    fun `heightFraction returns the same builder so calls chain`() {
        val builder = builder()
        assertSame(builder, builder.heightFraction(0.5f))
    }

    @Test
    fun `the range's own bounds are accepted`() {
        builder().heightFraction(FrakSharingDefaults.MIN_HEIGHT_FRACTION)
        builder().heightFraction(FrakSharingDefaults.MAX_HEIGHT_FRACTION)
    }

    @Test
    fun `the default is itself inside the accepted range`() {
        builder().heightFraction(FrakSharingDefaults.HEIGHT_FRACTION)
    }

    /**
     * The papercut this closes: the fraction used to be clamped in silence, so a merchant who
     * computed it wrong got a working-looking sheet at the wrong size and no diagnostic anywhere.
     * It now fails at the build site, with a message.
     */
    @Test
    fun `a fraction below the range is rejected loudly`() {
        assertThrows(IllegalArgumentException::class.java) { builder().heightFraction(0.1f) }
    }

    @Test
    fun `a fraction above the range is rejected loudly`() {
        assertThrows(IllegalArgumentException::class.java) { builder().heightFraction(2f) }
    }

    /**
     * The case a merchant computing a fraction actually reaches. `require(x in a..b)` catches it
     * for free — every comparison against NaN is false — but it is the reason the check is written
     * as two comparisons rather than a `coerceIn`, which lets NaN through unsignalled.
     */
    @Test
    fun `a non-finite fraction is rejected`() {
        assertThrows(IllegalArgumentException::class.java) { builder().heightFraction(Float.NaN) }
        assertThrows(IllegalArgumentException::class.java) {
            builder().heightFraction(Float.POSITIVE_INFINITY)
        }
        assertThrows(IllegalArgumentException::class.java) {
            builder().heightFraction(Float.NEGATIVE_INFINITY)
        }
    }
}
