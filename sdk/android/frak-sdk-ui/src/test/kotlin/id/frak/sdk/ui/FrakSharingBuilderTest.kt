package id.frak.sdk.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class FrakSharingBuilderTest {
    private fun builder() = FrakSharing.Builder { }

    /** The builder keeps no readable copy, so the clamp is asserted through what it passes on. */
    private fun fractionOf(builder: FrakSharing.Builder): Float {
        val field = FrakSharing.Builder::class.java.getDeclaredField("heightFraction")
        field.isAccessible = true
        return field.getFloat(builder)
    }

    @Test
    fun `heightFraction returns the same builder so calls chain`() {
        val builder = builder()
        assertSame(builder, builder.heightFraction(0.5f))
    }

    @Test
    fun `the range's own bounds are accepted unchanged`() {
        assertEquals(
            FrakSharingDefaults.MIN_HEIGHT_FRACTION,
            fractionOf(builder().heightFraction(FrakSharingDefaults.MIN_HEIGHT_FRACTION)),
            0f,
        )
        assertEquals(
            FrakSharingDefaults.MAX_HEIGHT_FRACTION,
            fractionOf(builder().heightFraction(FrakSharingDefaults.MAX_HEIGHT_FRACTION)),
            0f,
        )
    }

    @Test
    fun `a fraction outside the range is clamped, not thrown, so it matches iOS`() {
        assertEquals(FrakSharingDefaults.MIN_HEIGHT_FRACTION, fractionOf(builder().heightFraction(0.1f)), 0f)
        assertEquals(FrakSharingDefaults.MAX_HEIGHT_FRACTION, fractionOf(builder().heightFraction(2f)), 0f)
    }

    @Test
    fun `a non-finite fraction falls back to the default rather than reaching fillMaxHeight`() {
        for (bad in listOf(Float.NaN, Float.POSITIVE_INFINITY, Float.NEGATIVE_INFINITY)) {
            assertEquals(FrakSharingDefaults.HEIGHT_FRACTION, fractionOf(builder().heightFraction(bad)), 0f)
        }
    }
}
