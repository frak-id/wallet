#if canImport(UIKit)
    import Foundation
    import FrakSDK

    /// Holds one sharing `WKWebView` while a share surface is on screen, so presenting costs
    /// a fragment change instead of an engine boot. Driven by `SharingPresenter.warm()`, which is
    /// the only control: an explicit `warm()` always warms.
    ///
    /// No `pause()`/`resume()` here, unlike Android's `SharingWebViewHandle` (finding 9.5).
    /// Investigated and rejected, not overlooked — record of what was checked:
    ///
    /// A `WKWebView`, like any `UIView`, is composited by Core Animation only as part of a
    /// window's layer tree; a view that has never been in a window has nothing for the
    /// compositor to draw. The pooled view here never is one, for the entire warm period: `warm`
    /// and `acquire` only ever call methods on the bare `SharingWebView`/`WKWebView` instance —
    /// nothing in this file or `SharingWebView.swift` inserts it into a view hierarchy — and it
    /// only becomes part of one when `SharingWebViewContainer.makeUIView` builds it for an
    /// actually-presented sheet (`FrakSharingSheet`'s `PresentedSharingSession`, which SwiftUI
    /// only constructs once `SharingPresenter.presentation` is non-nil, i.e. after `acquire()`
    /// has already been called at the tap). `release()` then explicitly `removeFromSuperview()`s
    /// the view before handing it back to `warm()`, so the invariant holds on the way back in too.
    /// So the cost 9.5 describes on Android — a booted page compositing for as long as the
    /// merchant's screen is up — has no iOS analogue to fix: the warm view is already off the
    /// compositor by construction, not just momentarily.
    ///
    /// What's left is JavaScript/timers continuing in the WebContent process. Android's own
    /// writeup for `pause()`/`resume()` notes `onPause()` doesn't stop that either — only
    /// `pauseTimers()` does, and that is process-global and would reach a merchant's own web
    /// views, so it is rejected there too. WebKit already throttles timers/`requestAnimationFrame`
    /// for a page it doesn't consider visible, which an unattached view always is, on Safari's own
    /// background-tab logic. There is no public API to suspend a single `WKWebView`'s JavaScript
    /// short of that.
    ///
    /// Rejected alternatives, for completeness: `isHidden` is inert on a view with no window to
    /// hide from, and toggling it adds a resume-forgetting failure mode for no measured gain;
    /// `WKWebViewConfiguration.suppressesIncrementalRendering` only defers the first paint of a
    /// *subsequent* load, not ongoing compositing, so it doesn't address 9.5's concern at all.
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

        /// Boots the pooled view against `url`; only a change of URL does work. `url` must be
        /// the real merchant page (`SharingPageURL.warm`) — the merchant-keyed work is the slow part.
        func warm(_ url: String) {
            guard !destroyed, warmURL != url, let target = URL(string: url) else { return }
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
            guard let reused = pooled, !lent else {
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
