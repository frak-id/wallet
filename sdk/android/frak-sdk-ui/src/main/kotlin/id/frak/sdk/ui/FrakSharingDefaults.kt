package id.frak.sdk.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.unit.dp

/** Tunable defaults for [FrakSharing]. */
public object FrakSharingDefaults {
    /**
     * Default fraction of the screen the sharing sheet takes. All of it is the hosted page now
     * — there is no native title or footer left to share it with. iOS carries the same knob
     * (`FrakSharingDefaults.heightFraction`); keep both in step.
     *
     * Deliberately **not** `const`. A `const val` is inlined into the merchant's own bytecode at
     * their compile time, so a merchant who referenced it would be frozen at whatever this said
     * on the day they built — for a value documented as tunable, and across SDK upgrades that
     * change it. A plain `val` is read through a getter and tracks the artifact; `@JvmStatic`
     * keeps that getter reachable from Java as `FrakSharingDefaults.getHEIGHT_FRACTION()` rather
     * than through `INSTANCE`.
     */
    @JvmStatic
    public val HEIGHT_FRACTION: Float = 0.85f

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
 * Clamps a height fraction into `0.3..1.0` on the way to `fillMaxHeight`.
 *
 * Belt to [FrakSharing.Builder.heightFraction]'s braces, not a substitute for it. The Builder
 * rejects an out-of-range fraction loudly, at the build site, with a message — silently resizing
 * the sheet is exactly the papercut that change fixed. This stays because the value still crosses
 * an internal boundary before it reaches Compose, and `fillMaxHeight` *throws* on a non-finite
 * fraction: a crash inside the merchant's process is a worse answer than the default. `coerceIn`
 * treats NaN as in-range without signalling, so that case is checked explicitly.
 */
internal fun clampSharingHeightFraction(fraction: Float): Float {
    if (!fraction.isFinite()) return FrakSharingDefaults.HEIGHT_FRACTION
    return fraction.coerceIn(
        FrakSharingDefaults.MIN_HEIGHT_FRACTION,
        FrakSharingDefaults.MAX_HEIGHT_FRACTION,
    )
}
