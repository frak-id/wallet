package id.frak.sdk.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** The defensive clamp on a merchant-supplied height fraction. */
class FrakSharingDefaultsTest {
    @Test
    fun `a fraction inside the range is left alone`() {
        assertEquals(0.5f, clampSharingHeightFraction(0.5f))
        assertEquals(FrakSharingDefaults.MIN_HEIGHT_FRACTION, clampSharingHeightFraction(0.3f))
        assertEquals(FrakSharingDefaults.MAX_HEIGHT_FRACTION, clampSharingHeightFraction(1.0f))
    }

    @Test
    fun `a fraction outside the range is pulled back into it`() {
        assertEquals(FrakSharingDefaults.MIN_HEIGHT_FRACTION, clampSharingHeightFraction(0f))
        assertEquals(FrakSharingDefaults.MIN_HEIGHT_FRACTION, clampSharingHeightFraction(-1f))
        assertEquals(FrakSharingDefaults.MAX_HEIGHT_FRACTION, clampSharingHeightFraction(2f))
    }

    /** `fillMaxHeight` rejects a non-finite fraction, and `coerceIn` lets NaN through unsignalled. */
    @Test
    fun `a non-finite fraction falls back to the default`() {
        assertEquals(FrakSharingDefaults.HEIGHT_FRACTION, clampSharingHeightFraction(Float.NaN))
        assertEquals(
            FrakSharingDefaults.HEIGHT_FRACTION,
            clampSharingHeightFraction(Float.POSITIVE_INFINITY),
        )
        assertEquals(
            FrakSharingDefaults.HEIGHT_FRACTION,
            clampSharingHeightFraction(Float.NEGATIVE_INFINITY),
        )
    }

    @Test
    fun `the default is itself inside the clamp's range`() {
        assertEquals(
            FrakSharingDefaults.HEIGHT_FRACTION,
            clampSharingHeightFraction(FrakSharingDefaults.HEIGHT_FRACTION),
        )
    }
}
