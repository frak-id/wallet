#if canImport(UIKit)
    import Foundation
    import StoreKit
    import UIKit

    /// The listing as an `SKOverlay` banner, raised in place instead of sending the user to the
    /// App Store app.
    ///
    /// Attached to the `UIWindowScene`, not to the sheet that raised it, so it outlives that sheet
    /// by construction — `dismiss()` is the only thing that takes it back down.
    @MainActor
    final class StoreOverlayInvite: StoreInvite {
        private let options: FrakInstallPresentation.Overlay
        private var isPresented = false

        init(_ options: FrakInstallPresentation.Overlay) {
            self.options = options
        }

        /// Answers false on Mac Catalyst, where `SKOverlay` does not exist, and when there is no
        /// foreground scene to raise it in.
        @discardableResult
        func present() async -> Bool {
            // `SKOverlay` is unavailable on Mac Catalyst, which `canImport(UIKit)` doesn't exclude.
            #if targetEnvironment(macCatalyst)
                return false
            #else
                guard !isPresented else { return true }
                guard let scene = StoreInvites.foregroundScene() else { return false }
                SKOverlay(configuration: configuration()).present(in: scene)
                isPresented = true
                return true
            #endif
        }

        func dismiss() {
            guard isPresented else { return }
            isPresented = false
            #if !targetEnvironment(macCatalyst)
                guard let scene = StoreInvites.foregroundScene() else { return }
                SKOverlay.dismiss(in: scene)
            #endif
        }

        #if !targetEnvironment(macCatalyst)
            /// `userDismissible` is left at StoreKit's own default, which lets the user swipe the
            /// banner away. The alternative pins a store banner over the merchant's UI.
            private func configuration() -> SKOverlay.AppConfiguration {
                SKOverlay.AppConfiguration(
                    appIdentifier: StoreInvites.walletAppStoreId,
                    position: options.position.skOverlayPosition
                )
            }
        #endif
    }

    #if !targetEnvironment(macCatalyst)
        extension FrakInstallPresentation.Overlay.Position {
            var skOverlayPosition: SKOverlay.Position {
                switch self {
                case .bottom: return .bottom
                case .bottomRaised: return .bottomRaised
                }
            }
        }
    #endif
#endif
