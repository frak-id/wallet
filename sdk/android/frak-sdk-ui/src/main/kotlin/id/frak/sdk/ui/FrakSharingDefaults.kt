package id.frak.sdk.ui

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
