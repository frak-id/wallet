#if canImport(UIKit)
    import FrakSDK
    import SwiftUI

    // Heats DNS/TCP/TLS/web view engine/HTTP cache for the wallet origin ahead of the tap
    // that presents the sheet. Off unless FrakConfig.preloadSharing is set.
    // Never reused for the real session: SharingWebView binds its session id at construction.
    struct WarmSharingWebView: View {
        @StateObject private var warm = WarmSharingWebViewHolder()

        var body: some View {
            Color.clear
                .frame(width: 0, height: 0)
                .allowsHitTesting(false)
                .onAppear { warm.start() }
                .onDisappear { warm.stop() }
        }
    }

    @MainActor
    private final class WarmSharingWebViewHolder: ObservableObject {
        // Not a real session; warm view has no callbacks.
        private static let warmSessionId = "warm"

        private var webView: SharingWebView?

        func start() {
            guard webView == nil, Frak.preloadSharing, let client = try? Frak.client else { return }
            let origin = client.environment.wallet
            guard let url = URL(string: origin + "/sharing") else { return }

            let warm = SharingWebView(walletOrigin: origin, returnScheme: "", sessionId: Self.warmSessionId)
            warm.load(url)
            webView = warm
        }

        func stop() {
            webView?.stop()
            webView = nil
        }
    }
#endif
