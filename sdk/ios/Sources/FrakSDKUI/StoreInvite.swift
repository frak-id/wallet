#if canImport(UIKit)
    import Foundation
    import UIKit

    /// The wallet's App Store listing, raised from inside the sheet. Owns nothing else about the
    /// install flow.
    @MainActor
    protocol StoreInvite {
        /// - Returns: false when the listing could not be raised at all. The caller must hand off
        ///   to the app instead — opening the listing itself would send an already-installed
        ///   wallet's owner to its own store page.
        @discardableResult
        func present() async -> Bool

        func dismiss()
    }

    @MainActor
    enum StoreInvites {
        /// Frak Wallet, `id.frak.wallet`. The only id a listing is ever raised with; the one in
        /// the tapped link is not read, so a stale install page cannot downgrade the handoff.
        static let walletAppStoreId = "6759159306"

        static func make(_ presentation: FrakInstallPresentation) -> any StoreInvite {
            switch presentation {
            case .storeProductPage(let options):
                return StoreProductPageInvite(options)
            case .overlay(let options):
                return StoreOverlayInvite(options)
            }
        }

        static func foregroundScene() -> UIWindowScene? {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first { $0.activationState == .foregroundActive }
        }

        /// The controller a modal has to be presented from: UIKit refuses one presented from a
        /// controller already presenting, which the sheet's own host is.
        static func topViewController() -> UIViewController? {
            guard var top = foregroundScene()?.keyWindow?.rootViewController else { return nil }
            while let presented = top.presentedViewController, !presented.isBeingDismissed {
                top = presented
            }
            return top
        }
    }
#endif
