#if canImport(UIKit)
    import Foundation
    import StoreKit
    import UIKit

    /// The listing as an `SKStoreProductViewController`, presented over the sheet.
    ///
    /// Modal, so it is torn down with whatever presented it — unlike an `SKOverlay`, which the
    /// scene keeps. A download the user started survives either way.
    @MainActor
    final class StoreProductPageInvite: NSObject, StoreInvite, SKStoreProductViewControllerDelegate {
        /// Longest wait for `loadProduct` before handing off to the App Store app instead. The
        /// user tapped Install and is looking at an unchanged page for the whole of it.
        private static let loadDeadline: TimeInterval = 5

        private let options: FrakInstallPresentation.StoreProductPage
        private var controller: SKStoreProductViewController?
        private var loading: CheckedContinuation<Bool, Never>?

        init(_ options: FrakInstallPresentation.StoreProductPage) {
            self.options = options
        }

        /// Answers false when the product could not be loaded, or when nothing is on screen to
        /// present it from. Loads before presenting: presenting first puts up a blank page that
        /// never fills in when the load fails.
        @discardableResult
        func present() async -> Bool {
            // A second store link while one is up would present over the page itself, and a
            // second load would strand the first continuation unresumed. Already handled.
            guard self.controller == nil, loading == nil else { return true }
            let controller = SKStoreProductViewController()
            controller.delegate = self
            guard await load(controller) else { return false }
            // Resolved after the load, not before: the sheet can be gone by the time it lands.
            guard let host = StoreInvites.topViewController() else { return false }
            self.controller = controller
            host.present(controller, animated: true)
            return true
        }

        func dismiss() {
            guard let controller else { return }
            self.controller = nil
            controller.presentingViewController?.dismiss(animated: true)
        }

        nonisolated func productViewControllerDidFinish(_ viewController: SKStoreProductViewController) {
            Task { @MainActor [weak self] in self?.dismiss() }
        }

        private func load(_ controller: SKStoreProductViewController) async -> Bool {
            await withCheckedContinuation { continuation in
                loading = continuation
                controller.loadProduct(withParameters: parameters()) { @Sendable [weak self] loaded, _ in
                    // Not documented to arrive on the main thread, and only Sendable values may cross.
                    Task { @MainActor in self?.settleLoad(loaded) }
                }
                Task { @MainActor [weak self] in
                    try? await Task.sleep(nanoseconds: UInt64(Self.loadDeadline * 1_000_000_000))
                    self?.settleLoad(false)
                }
            }
        }

        /// Whichever of the load and its deadline lands first; the other is a no-op.
        private func settleLoad(_ loaded: Bool) {
            guard let continuation = loading else { return }
            loading = nil
            continuation.resume(returning: loaded)
        }

        private func parameters() -> [String: Any] {
            // An `NSNumber`, not the string the overlay's `appIdentifier` takes.
            var parameters: [String: Any] = [
                SKStoreProductParameterITunesItemIdentifier: NSNumber(
                    value: Int(StoreInvites.walletAppStoreId) ?? 0
                )
            ]
            if let campaignToken = options.campaignToken {
                parameters[SKStoreProductParameterCampaignToken] = campaignToken
            }
            if let providerToken = options.providerToken {
                parameters[SKStoreProductParameterProviderToken] = providerToken
            }
            if let customProductPageId = options.customProductPageId {
                parameters[SKStoreProductParameterCustomProductPageIdentifier] = customProductPageId
            }
            return parameters
        }
    }
#endif
