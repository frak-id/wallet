package id.frak.sdk.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp

/** Tunable defaults for [FrakSharing]. */
public object FrakSharingDefaults {
    /**
     * Default fraction of the screen the sharing sheet takes. Not `const`: a `const val` would be
     * inlined into the merchant's bytecode and frozen at their compile time. Mirrored on the
     * other platform; keep both in step.
     */
    @JvmStatic
    public val HEIGHT_FRACTION: Float = 0.85f

    /** Lowest fraction a merchant may ask for; below it the hosted page is unusable. */
    internal const val MIN_HEIGHT_FRACTION: Float = 0.3f

    /** Highest fraction a merchant may ask for. */
    internal const val MAX_HEIGHT_FRACTION: Float = 1.0f
}

/**
 * Radius of the sheet's two top corners, in dp. Pinned rather than read from the theme because the
 * skeleton's clip and the `--frak-host-top-radius` property [SharingHostStyle] injects have to
 * agree without seeing each other. 28dp is M3's own `CornerExtraLargeTop`, and 1 CSS px == 1 dp
 * inside a WebView at `width=device-width`.
 */
internal const val SHEET_CORNER_RADIUS_DP: Int = 28

/** [SHEET_CORNER_RADIUS_DP] as a shape, for the native chrome that still clips itself. */
internal val SheetCornerShape: RoundedCornerShape =
    RoundedCornerShape(topStart = SHEET_CORNER_RADIUS_DP.dp, topEnd = SHEET_CORNER_RADIUS_DP.dp)

/**
 * Clamps a height fraction into `0.3..1.0` on the way to `fillMaxHeight`, which throws on a
 * non-finite fraction. Belt to [FrakSharing.Builder.heightFraction]'s own check; `coerceIn` treats
 * NaN as in-range, so that case is checked explicitly.
 */
internal fun clampSharingHeightFraction(fraction: Float): Float {
    if (!fraction.isFinite()) return FrakSharingDefaults.HEIGHT_FRACTION
    return fraction.coerceIn(
        FrakSharingDefaults.MIN_HEIGHT_FRACTION,
        FrakSharingDefaults.MAX_HEIGHT_FRACTION,
    )
}
