#if canImport(UIKit)
    import Foundation
    import StoreKit
    import UIKit

    /// The listing as an `SKStoreProductViewController`, presented over the sheet on a window of
    /// its own.
    ///
    /// Its own window because the sheet is a SwiftUI `.sheet`: presenting from that sheet's host
    /// puts the page in the sheet's presentation chain, and taking it back out of that chain
    /// dismisses the sheet with it — the install code included. Nothing here touches the host.
    @MainActor
    final class StoreProductPageInvite: NSObject, StoreInvite, SKStoreProductViewControllerDelegate {
        /// Longest wait for `loadProduct` before handing off to the App Store app instead. The
        /// user tapped Install and is looking at an unchanged page for the whole of it.
        private static let loadDeadline: TimeInterval = 5

        private let options: FrakInstallPresentation.StoreProductPage
        private var window: UIWindow?
        private var loading: CheckedContinuation<Bool, Never>?

        init(_ options: FrakInstallPresentation.StoreProductPage) {
            self.options = options
        }

        /// Answers false when the product could not be loaded, or when there is no scene to build
        /// a window in. Loads before presenting: presenting first puts up a blank page that never
        /// fills in when the load fails.
        @discardableResult
        func present() async -> Bool {
            // A second store link while one is up would stack a second page, and a second load
            // would strand the first continuation unresumed. Already handled.
            guard window == nil, loading == nil else { return true }
            let controller = SKStoreProductViewController()
            controller.delegate = self
            guard await load(controller) else { return false }
            // Resolved after the load, not before: the scene can be gone by the time it lands.
            guard let scene = StoreInvites.foregroundScene() else { return false }

            let window = hostWindow(in: scene)
            self.window = window
            window.rootViewController?.present(controller, animated: true)
            return true
        }

        /// Takes the page down if it is still up, and drops the window either way so a later
        /// install tap can raise a fresh one.
        func dismiss() {
            guard let window, let root = window.rootViewController else { return }
            self.window = nil
            guard root.presentedViewController != nil else {
                discard(window)
                return
            }
            // The strong capture is load-bearing: it holds the window up for the dismissal
            // animation that is drawing in it.
            root.dismiss(animated: true) { [weak self] in
                self?.discard(window)
            }
        }

        /// StoreKit closes the page itself before this arrives, so this usually only drops the
        /// window left behind it.
        nonisolated func productViewControllerDidFinish(_ viewController: SKStoreProductViewController) {
            Task { @MainActor [weak self] in self?.dismiss() }
        }

        /// A window of this invite's own, one level above the sheet's.
        ///
        /// Never made key: the sheet's web view keeps first responder, so taking this window
        /// down again cannot disturb what is underneath it.
        private func hostWindow(in scene: UIWindowScene) -> UIWindow {
            let root = UIViewController()
            root.view.backgroundColor = .clear

            let window = UIWindow(windowScene: scene)
            window.rootViewController = root
            window.windowLevel = .normal + 1
            window.backgroundColor = .clear
            window.isHidden = false
            return window
        }

        private func discard(_ window: UIWindow) {
            window.isHidden = true
            window.rootViewController = nil
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
