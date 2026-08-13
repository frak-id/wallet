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
public enum FrakInstallPresentation: Sendable, Hashable {
    /// A modal store page over the sheet. The user comes back to the sheet when it closes.
    case storeProductPage(StoreProductPage)

    /// A banner attached to the window scene. It installs in place and does not cover the
    /// sheet, at the cost of no styling control and no report of whether it drew.
    case overlay(Overlay)

    public static var storeProductPage: Self { .storeProductPage(StoreProductPage()) }

    public static var overlay: Self { .overlay(Overlay()) }

    /// `SKStoreProductViewController` parameters. All optional, all attribution.
    public struct StoreProductPage: Sendable, Hashable {
        /// App Analytics campaign token.
        public var campaignToken: String?
        /// Provider token of the developer presenting the listing.
        public var providerToken: String?
        /// A custom product page to show instead of the default listing.
        public var customProductPageId: String?

        public init(
            campaignToken: String? = nil,
            providerToken: String? = nil,
            customProductPageId: String? = nil
        ) {
            self.campaignToken = campaignToken
            self.providerToken = providerToken
            self.customProductPageId = customProductPageId
        }
    }

    /// `SKOverlay.AppConfiguration` parameters.
    public struct Overlay: Sendable, Hashable {
        /// Mirrors `SKOverlay.Position`, which does not exist on Mac Catalyst.
        public enum Position: Sendable, Hashable {
            case bottom
            case bottomRaised
        }

        public var position: Position
        /// Whether the user can swipe the banner away.
        public var userDismissible: Bool
        /// App Analytics campaign token.
        public var campaignToken: String?
        /// Provider token of the developer presenting the listing.
        public var providerToken: String?
        /// A custom product page to show instead of the default listing.
        public var customProductPageId: String?

        public init(
            position: Position = .bottom,
            userDismissible: Bool = true,
            campaignToken: String? = nil,
            providerToken: String? = nil,
            customProductPageId: String? = nil
        ) {
            self.position = position
            self.userDismissible = userDismissible
            self.campaignToken = campaignToken
            self.providerToken = providerToken
            self.customProductPageId = customProductPageId
        }
    }
}
