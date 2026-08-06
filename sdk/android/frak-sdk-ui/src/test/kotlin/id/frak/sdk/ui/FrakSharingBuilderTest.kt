package id.frak.sdk.ui

import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Test

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

    @Test
    fun `a fraction below the range is rejected loudly`() {
        assertThrows(IllegalArgumentException::class.java) { builder().heightFraction(0.1f) }
    }

    @Test
    fun `a fraction above the range is rejected loudly`() {
        assertThrows(IllegalArgumentException::class.java) { builder().heightFraction(2f) }
    }

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
