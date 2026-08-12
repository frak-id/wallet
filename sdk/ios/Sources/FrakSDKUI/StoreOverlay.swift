#if canImport(UIKit)
    import Foundation
    import StoreKit
    import UIKit

    /// The wallet's App Store listing, raised in place as an `SKOverlay` instead of sending the
    /// user to the App Store app. Owns nothing else about the install flow.
    ///
    /// Attached to the `UIWindowScene`, not to the sheet that raised it, so it outlives that sheet
    /// by construction — `dismiss()` is the only thing that takes it back down.
    @MainActor
    final class StoreOverlay {
        private static let appStoreHost = "apps.apple.com"
        /// Frak Wallet, `id.frak.wallet`. The only id an overlay is ever raised with; the one in
        /// the tapped link is not read, so a stale install page cannot downgrade the handoff.
        private static let walletAppStoreId = "6759159306"

        private(set) var isPresented = false

        /// What the caller must still do about a URL this was offered.
        enum Handling {
            /// The overlay is up; nothing left to do.
            case handled
            /// Not an App Store listing — open it however the caller normally would.
            case notAListing
            /// The wallet's listing, but no foreground scene to raise an overlay in. Opening the
            /// URL would send an already-installed wallet's owner to its own store page, so the
            /// caller should hand off to the app instead.
            case needsAppHandoff
        }

        /// Raises the overlay if `url` is the wallet's App Store listing.
        func present(for url: URL) -> Handling {
            guard isWalletAppStoreListing(url) else { return .notAListing }
            // `SKOverlay` is unavailable on Mac Catalyst, which `canImport(UIKit)` doesn't exclude.
            #if targetEnvironment(macCatalyst)
                return .needsAppHandoff
            #else
                guard let scene = foregroundScene() else { return .needsAppHandoff }
                let configuration = SKOverlay.AppConfiguration(
                    appIdentifier: Self.walletAppStoreId,
                    position: .bottom
                )
                SKOverlay(configuration: configuration).present(in: scene)
                isPresented = true
                return .handled
            #endif
        }

        func dismiss() {
            guard isPresented else { return }
            isPresented = false
            #if !targetEnvironment(macCatalyst)
                guard let scene = foregroundScene() else { return }
                SKOverlay.dismiss(in: scene)
            #endif
        }

        private func foregroundScene() -> UIWindowScene? {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first { $0.activationState == .foregroundActive }
        }

        /// Any App Store listing on `apps.apple.com`, deliberately not matched on the wallet's id.
        ///
        /// The overlay is always raised with `walletAppStoreId`, so the id in the URL only has to
        /// say "this is a store listing", not which one. Matching the id itself would tie a
        /// constant frozen into the merchant's binary at submission to a page served live, and the
        /// tap would silently degrade to a plain store handoff the first time either side changed.
        ///
        /// Scans path components, so storefront-prefixed forms like `/us/app/name/id123` match.
        private func isWalletAppStoreListing(_ url: URL) -> Bool {
            guard url.host?.caseInsensitiveCompare(Self.appStoreHost) == .orderedSame else {
                return false
            }
            return url.pathComponents.contains { component in
                guard component.hasPrefix("id") else { return false }
                let digits = component.dropFirst(2)
                return !digits.isEmpty && digits.allSatisfy(\.isNumber)
            }
        }
    }
#endif
