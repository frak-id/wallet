#if canImport(UIKit)
    import Foundation
    import FrakSDK

    /// Holds one sharing `WKWebView` while a share surface is on screen, so presenting costs
    /// a fragment change instead of an engine boot. Gated behind `FrakConfig.preloadSharing`.
    @MainActor
    final class SharingWebViewPool {
        private let walletOrigin: String
        private let preload: Bool

        private var pooled: SharingWebView?

        private var lent = false

        private var warmURL: String?

        private var destroyed = false

        init(walletOrigin: String, preload: Bool) {
            self.walletOrigin = walletOrigin
            self.preload = preload
        }

        var warmView: SharingWebView? { lent ? nil : pooled }

        var hasWarmView: Bool { warmView != nil }

        /// Boots the pooled view against `url`; only a change of URL does work. `url` must be
        /// the real merchant page (`SharingPageURL.warm`) — the merchant-keyed work is the slow part.
        func warm(_ url: String) {
            guard preload, !destroyed, warmURL != url, let target = URL(string: url) else { return }
            warmURL = url
            let trace = SharingTrace()
            trace.mark("warm load starting")
            let view = pooled ?? makeView()
            pooled = view
            // Rebound so the warm load's `documentReady` is recorded — activation depends on it.
            view.bind(
                SharingWebViewBinding(
                    sessionId: SharingPageURL.warmSessionId,
                    onPageReady: { [weak view] in
                        view?.onDocumentReady()
                        trace.mark("warm document finished")
                    },
                    onLoadFailed: { trace.mark("warm load FAILED") }
                )
            )
            view.load(target, baseURL: url)
        }

        /// The view the sheet should present, already bound to `binding`. Detached from any
        /// previous superview first: a reopened sheet can race SwiftUI's own removal.
        func acquire(_ binding: SharingWebViewBinding) -> SharingWebView {
            guard preload, let reused = pooled, !lent else {
                let view = makeView()
                view.bind(binding)
                return view
            }
            lent = true
            reused.view.removeFromSuperview()
            // Only stop a load that cannot be salvaged — a finished document is what the
            // session activates on top of.
            if !reused.documentReady { reused.stopLoading() }
            reused.bind(binding)
            return reused
        }

        /// Takes the view back when a sheet closes. Reset rather than destroyed: rebound to
        /// `.warm` and fully reloaded, since the page it leaves behind is mid-flow.
        func release(_ view: SharingWebView) {
            // Not ours, or ours but the surface has gone away underneath it: no future either way.
            guard view === pooled, !destroyed else {
                if view === pooled {
                    pooled = nil
                    warmURL = nil
                }
                lent = false
                view.view.removeFromSuperview()
                view.destroy()
                return
            }
            lent = false
            view.view.removeFromSuperview()
            view.stopLoading()
            let url = warmURL
            // Re-warm rather than reload: only `warm` rebinds the readiness callback. Cleared
            // first so it does not short-circuit on an unchanged URL.
            warmURL = nil
            if let url {
                warm(url)
            } else {
                // Never warmed: just make sure a late navigation from the closed session
                // reports nowhere.
                view.bind(.warm)
            }
        }

        /// Drops the pooled view when the share surface leaves the screen. Will not pull it out
        /// of a live sheet — the pool marks itself dead and `release` destroys it instead.
        func destroy() {
            destroyed = true
            guard !lent, let view = pooled else { return }
            pooled = nil
            warmURL = nil
            view.view.removeFromSuperview()
            view.destroy()
        }

        private func makeView() -> SharingWebView {
            SharingWebView(
                walletOrigin: walletOrigin,
                returnScheme: SharingPageURL.returnScheme(bundleId: Bundle.main.bundleIdentifier ?? "")
            )
        }
    }
#endif
