import CoreGraphics

/// Tunable defaults for `FrakSharingConfiguration`.
public enum FrakSharingDefaults {
    public static let heightFraction: CGFloat = 0.85

    /// The store page, not the overlay: it reports whether it drew, it can be styled through a
    /// custom product page, and it hands the sheet back when the user closes it.
    public static let install: FrakInstallPresentation = .storeProductPage

    /// Follows the opt-in `isFrakAppInstalled()` already requires; see `FrakSharingConfiguration`.
    public static let detectInstall = true
}

/// The range a caller-supplied `heightFraction` is clamped into.
let sharingHeightFractionRange: ClosedRange<CGFloat> = 0.3...1.0

/// Clamps a merchant-supplied `heightFraction` into `sharingHeightFractionRange`. A non-finite
/// input answers the default, since `min`/`max` treat NaN as out of range without signalling.
func clampedSharingHeightFraction(_ fraction: CGFloat) -> CGFloat {
    guard fraction.isFinite else { return FrakSharingDefaults.heightFraction }
    return min(max(fraction, sharingHeightFractionRange.lowerBound), sharingHeightFractionRange.upperBound)
}
