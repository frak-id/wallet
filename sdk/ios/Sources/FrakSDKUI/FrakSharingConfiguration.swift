import CoreGraphics

/// How the sharing sheet is presented, as opposed to what it shares.
public struct FrakSharingConfiguration: Sendable, Hashable {
    /// Fraction of the screen height the sheet occupies, clamped to `0.3...1.0`.
    public var heightFraction: CGFloat

    /// How the wallet's App Store listing is raised when the user asks to install it.
    public var install: FrakInstallPresentation

    public init(
        heightFraction: CGFloat = FrakSharingDefaults.heightFraction,
        install: FrakInstallPresentation = FrakSharingDefaults.install
    ) {
        self.heightFraction = heightFraction
        self.install = install
    }
}

/// Which StoreKit surface offers the wallet install from the sheet's install step.
///
/// Neither carries App Store attribution: `campaignToken`, `providerToken` and
/// `customProductPageIdentifier` all resolve inside the presented app's own App Store Connect
/// account, which is the wallet's, never the merchant's.
public enum FrakInstallPresentation: Sendable, Hashable {
    /// A modal store page over the sheet. The user comes back to the sheet when it closes.
    case storeProductPage

    /// A banner attached to the window scene. It installs in place and does not cover the
    /// sheet, at the cost of no styling control and no report of whether it drew.
    case overlay(Overlay)

    public static var overlay: Self { .overlay(Overlay()) }

    /// Where the banner sits on the merchant's own screen.
    ///
    /// A struct rather than a bare associated value so a later knob is additive: adding a
    /// defaulted property cannot break a caller, adding a case parameter can.
    public struct Overlay: Sendable, Hashable {
        /// Mirrors `SKOverlay.Position`, which does not exist on Mac Catalyst.
        public enum Position: Sendable, Hashable {
            case bottom
            case bottomRaised
        }

        public var position: Position

        public init(position: Position = .bottom) {
            self.position = position
        }
    }
}
