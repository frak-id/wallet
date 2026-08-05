package id.frak.sdk.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp

/** Tunable defaults for [rememberFrakSharingLauncher]. */
public object FrakSharingDefaults {
    /**
     * Default fraction of the screen the sharing sheet takes. All of it is the hosted page now
     * — there is no native title or footer left to share it with. iOS carries the same knob
     * (`FrakSharingDefaults.heightFraction`); keep both in step.
     */
    public const val HEIGHT_FRACTION: Float = 0.85f

    /** Lowest fraction a merchant may ask for; below it the hosted page is unusable. */
    internal const val MIN_HEIGHT_FRACTION: Float = 0.3f

    /** Highest fraction a merchant may ask for. */
    internal const val MAX_HEIGHT_FRACTION: Float = 1.0f
}

/**
 * Radius of the sheet's two top corners, in dp.
 *
 * Pinned rather than read from `BottomSheetDefaults.ExpandedShape` (which resolves through
 * `MaterialTheme.shapes.extraLarge`) because two places that cannot see each other's theme have to
 * agree on it: the skeleton's own clip, and the `--frak-host-top-radius` custom property
 * [SharingHostStyle] injects for the hosted page to round itself with. A merchant reshaping
 * `extraLarge` would desynchronise them for no visible gain — the page paints every pixel of this
 * sheet, so its own radius is the only one that is ever on screen once it has loaded.
 *
 * 28dp is M3's own `CornerExtraLargeTop`, i.e. what the sheet looked like before the rounding
 * moved off the web view. 1 CSS px == 1 dp inside a WebView at `width=device-width`, so the same
 * number serves both.
 */
internal const val SHEET_CORNER_RADIUS_DP: Int = 28

/** [SHEET_CORNER_RADIUS_DP] as a shape, for the native chrome that still clips itself. */
internal val SheetCornerShape: RoundedCornerShape =
    RoundedCornerShape(topStart = SHEET_CORNER_RADIUS_DP.dp, topEnd = SHEET_CORNER_RADIUS_DP.dp)

/**
 * Clamps a merchant-supplied height fraction into `0.3..1.0`.
 *
 * A non-finite input (NaN, ±infinity — reachable when a caller computes the fraction) answers
 * the default rather than propagating into `fillMaxHeight`, which rejects it. `coerceIn` treats
 * NaN as in-range without signalling, so this is checked explicitly.
 */
internal fun clampSharingHeightFraction(fraction: Float): Float {
    if (!fraction.isFinite()) return FrakSharingDefaults.HEIGHT_FRACTION
    return fraction.coerceIn(
        FrakSharingDefaults.MIN_HEIGHT_FRACTION,
        FrakSharingDefaults.MAX_HEIGHT_FRACTION,
    )
}
