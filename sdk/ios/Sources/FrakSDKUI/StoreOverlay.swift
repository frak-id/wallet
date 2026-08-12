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
        /// Frak Wallet, `id.frak.wallet`. The only id an overlay is ever raised with; the one in
        /// the tapped link is not read, so a stale install page cannot downgrade the handoff.
        private static let walletAppStoreId = "6759159306"

        private(set) var isPresented = false

        /// Raises the overlay over the current scene.
        ///
        /// - Returns: false when there is no foreground scene to raise it in, or on Mac Catalyst
        ///   where `SKOverlay` does not exist. The caller must hand off to the app instead —
        ///   opening the listing itself would send an already-installed wallet's owner to its own
        ///   store page.
        @discardableResult
        func present() -> Bool {
            // `SKOverlay` is unavailable on Mac Catalyst, which `canImport(UIKit)` doesn't exclude.
            #if targetEnvironment(macCatalyst)
                return false
            #else
                guard let scene = foregroundScene() else { return false }
                let configuration = SKOverlay.AppConfiguration(
                    appIdentifier: Self.walletAppStoreId,
                    position: .bottom
                )
                SKOverlay(configuration: configuration).present(in: scene)
                isPresented = true
                return true
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
    }
#endif
