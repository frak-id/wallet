#if canImport(UIKit)
    import Foundation
    import FrakSDK

    /// Holds one sharing `WKWebView` while a share surface is on screen, so presenting costs a
    /// fragment change instead of an engine boot. `SharingPresenter.warm()` is the only control.
    /// No `pause()`/`resume()`: the pooled view is never in a window, so nothing composites it.
    @MainActor
    final class SharingWebViewPool {
        private let walletOrigin: String

        private var pooled: SharingWebView?

        private var lent = false

        private var warmURL: String?

        private var destroyed = false

        init(walletOrigin: String) {
            self.walletOrigin = walletOrigin
        }

        var warmView: SharingWebView? { lent ? nil : pooled }

        var hasWarmView: Bool { warmView != nil }

        /// Builds the pooled engine, without navigating it.
        ///
        /// Split from `warm(_:)`: constructing a `WKWebView` boots two processes (hundreds of ms,
        /// main-thread-only) and needs only a wallet origin, while the URL needs an identity mint
        /// and a merchant resolve first. Fused, a fast tap pays the boot inside the presentation.
        func prepare() {
            guard !destroyed, pooled == nil else { return }
            let trace = SharingTrace()
            let view = makeView()
            view.bind(warmBinding(view, trace: trace))
            pooled = view
            trace.mark("warm engine allocated")
        }

        /// Boots the pooled view against `url`; only a change of URL does work. `url` must be
        /// the real merchant page (`SharingPageURL.warm`) — the merchant-keyed work is the slow part.
        func warm(_ url: String) {
            // `!lent` as well as `!destroyed`: a lent view is on screen mid-session, and warming it
            // would navigate the sheet the user is looking at back to the merchant page.
            guard !destroyed, !lent else { return }
            // A jetsammed idle view leaves `warmURL` claiming a page that is gone, and the short
            // circuit below would then decline to load it again for the rest of this pool's life.
            // Reloaded, not rebuilt: WebKit hands the view a new content process on the next load.
            if pooled?.rendererGone == true { warmURL = nil }
            guard warmURL != url, let target = URL(string: url) else { return }
            warmURL = url
            let trace = SharingTrace()
            trace.mark("warm load starting")
            let view = pooled ?? makeView()
            pooled = view
            // Rebound so the warm load's `documentReady` is recorded — activation depends on it.
            view.bind(warmBinding(view, trace: trace))
            view.load(target, baseURL: url)
        }

        /// The view the sheet should present, already bound to `binding`. Detached from any
        /// previous superview first: a reopened sheet can race SwiftUI's own removal.
        func acquire(_ binding: SharingWebViewBinding) -> SharingWebView {
            guard let reused = pooled, !lent else {
                // Nothing to lend: `prepare()` has not run, or a previous sheet still holds the
                // pooled view. Adopted, not handed out loose — `release` destroys an unadopted
                // view, which would leave a pool that started cold cold for its whole life.
                let view = makeView()
                view.bind(binding)
                if pooled == nil, !destroyed {
                    pooled = view
                    lent = true
                }
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

        /// Replaces the pooled engine with a fresh one, bound to the same session.
        ///
        /// For the case a reload cannot reach: a content process reclaimed without
        /// `webViewWebContentProcessDidTerminate` leaves a `WKWebView` that still answers, still
        /// reports `didFinish`, and has no document behind it — Web Inspector lists the target and
        /// shows nothing. Only a new engine recovers that.
        func rebuild(_ binding: SharingWebViewBinding) -> SharingWebView? {
            guard !destroyed else { return nil }
            pooled?.view.removeFromSuperview()
            pooled?.stopLoading()
            let view = makeView()
            view.bind(binding)
            pooled = view
            lent = true
            warmURL = nil
            return view
        }

        /// Takes the view back when a sheet closes: reset in place wherever possible.
        ///
        /// A session that activated on the warm document only moved its params, so putting them
        /// back is a fragment change — no request, no React boot, and the next sheet activates
        /// instead of loading. Reloading here would throw the booted page away after every share.
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

            let reclaim = sharingReclaim(
                warmURL: warmURL,
                loadedBaseURL: view.loadedBaseURL,
                documentReady: view.documentReady
            )
            switch reclaim {
            case .park:
                // Never warmed, so there is nothing to put back — just make sure a late
                // navigation from the closed session reports nowhere.
                view.stopLoading()
                view.bind(.warm)
            case .resetInPlace:
                let trace = SharingTrace()
                // Rebound first: only the warm binding records `documentReady`, which is what the
                // next session's activation is gated on.
                view.bind(warmBinding(view, trace: trace))
                trace.mark("warm reset in place")
                view.resetToWarm()
            case .reload(let url):
                let trace = SharingTrace()
                view.bind(warmBinding(view, trace: trace))
                trace.mark("warm reload")
                view.stopLoading()
                // Cleared so `warm` does not short-circuit on an unchanged URL.
                warmURL = nil
                warm(url)
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

        /// What an unpresented view carries: a `warmSessionId` no sheet can be attributed to, and
        /// the one callback that records `documentReady` — the gate every activation is taken on.
        private func warmBinding(_ view: SharingWebView, trace: SharingTrace) -> SharingWebViewBinding {
            SharingWebViewBinding(
                sessionId: SharingPageURL.warmSessionId,
                onPageReady: { [weak view] in
                    view?.onDocumentReady()
                    trace.mark("warm document finished")
                },
                onLoadFailed: { trace.mark("warm load FAILED") }
            )
        }
    }
#endif
