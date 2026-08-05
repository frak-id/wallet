#if canImport(UIKit)
    import Foundation
    import FrakSDK

    /// Holds one sharing `WKWebView` for as long as a share surface is on screen.
    ///
    /// Gated behind `FrakConfig.preloadSharing`. With it off this is a plain factory — a fresh
    /// view per sheet, destroyed with it, which is what the SDK has always done. With it on, one
    /// view is booted against the real merchant page the moment the config resolves and then
    /// handed to the sheet itself, so presenting costs a fragment change rather than engine
    /// startup, TLS, the React bundle and a JavaScriptCore warm-up.
    ///
    /// One view per pool, so hoist `.frakSharingSheet(...)` per screen, not per row. The
    /// presenter already refuses a second concurrent sheet, so the single view can never be
    /// wanted twice at once.
    @MainActor
    final class SharingWebViewPool {
        private let walletOrigin: String
        private let preload: Bool

        private var pooled: SharingWebView?

        /// True while `pooled` is inside a sheet, so `destroy` knows not to pull it out from
        /// under one.
        private var lent = false

        /// The URL `warm` last booted the pooled view on, so a session can tell whether it may
        /// activate on top of it.
        private var warmURL: String?

        /// Set by `destroy`. A pool whose surface has gone must not warm again, and must destroy
        /// on release.
        private var destroyed = false

        init(walletOrigin: String, preload: Bool) {
            self.walletOrigin = walletOrigin
            self.preload = preload
        }

        /// The view `acquire` would hand out, or nil when the next sheet gets a cold one.
        ///
        /// Exposed so a caller can ask what state the warm-up reached — `documentReady` is what
        /// decides whether a session may activate on top of it rather than load the page again.
        var warmView: SharingWebView? { lent ? nil : pooled }

        /// Whether the next `acquire` will get the warm view rather than a cold one. Diagnostic;
        /// see `SharingTrace`.
        var hasWarmView: Bool { warmView != nil }

        /// Boots the pooled view against `url`. Cheap to call repeatedly; only a change of URL
        /// does work.
        ///
        /// `url` is the *real* merchant page (see `SharingPageURL.warm`), not a neutral one: the
        /// bundle, i18n and both merchant-keyed queries are the expensive part, and none of them
        /// can start without a merchantId. `state=warm` in that URL is what keeps the page from
        /// reporting itself as viewed while it sits here unseen.
        ///
        /// Called once the merchant config resolves rather than at view construction, which is
        /// why this takes a URL instead of building one — the identity simply is not known any
        /// earlier.
        func warm(_ url: String) {
            guard preload, !destroyed, warmURL != url, let target = URL(string: url) else { return }
            warmURL = url
            let trace = SharingTrace()
            trace.mark("warm load starting")
            let view = pooled ?? makeView()
            pooled = view
            // Bound rather than left on the shared default so the warm load's own milestones are
            // traceable, and — the load-bearing half — so `documentReady` is recorded. Whether
            // the warm load even finished before the user tapped is the difference between
            // activating by fragment and paying for the page twice.
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

        /// The view the sheet should present, already bound to `binding`.
        ///
        /// Detaches from any previous superview first: SwiftUI removes the view when its
        /// `UIViewRepresentable` leaves the hierarchy, but a torn-down-and-immediately-reopened
        /// sheet can race that, and a still-parented view would be moved rather than added.
        func acquire(_ binding: SharingWebViewBinding) -> SharingWebView {
            guard preload, let reused = pooled, !lent else {
                let view = makeView()
                view.bind(binding)
                return view
            }
            lent = true
            reused.view.removeFromSuperview()
            // Only stop a load that cannot be salvaged. A finished warm document is what the
            // session activates on top of, and stopping a finished page is a no-op anyway; an
            // unfinished one is going to be replaced by a full load, and stopping it keeps it
            // from racing that for the network. The view ignores its callbacks either way (see
            // `navigationOwnedByBinding`).
            if !reused.documentReady { reused.stopLoading() }
            reused.bind(binding)
            return reused
        }

        /// Takes the view back when a sheet closes.
        ///
        /// The pooled view is reset rather than destroyed: rebound to `.warm` so a late
        /// navigation from the closed session reports nowhere, and sent back to the warm URL so
        /// the next sheet neither inherits the last one's confirmation screen nor pays for a cold
        /// bundle. The sheet's skeleton covers the stale frame either way.
        ///
        /// Reloading the warm URL is a full navigation on purpose, even though the session that
        /// just ended reached it by fragment. The page it leaves behind is mid-flow — a
        /// confirmation screen, an install page, a toast — and only a fresh document reliably
        /// undoes all of that.
        func release(_ view: SharingWebView) {
            // Not ours, or ours but the surface has gone away underneath it — either way this
            // view has no future, and `destroy` deliberately left it to the sheet that was still
            // driving it.
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
            // Re-warm rather than just reload: `warm` is what rebinds the readiness callback, and
            // without it `documentReady` would never come back and every later sheet would decide
            // it cannot activate. Cleared first so `warm` does not short-circuit on an unchanged
            // URL.
            warmURL = nil
            if let url {
                warm(url)
            } else {
                // Never warmed (preload off, or config never resolved): nothing to return it to,
                // so just make sure a late navigation from the closed session reports nowhere.
                view.bind(.warm)
            }
        }

        /// Drops the pooled view when the share surface leaves the screen.
        ///
        /// Will not pull the view out of a sheet that is still using it: a `WKWebView` whose
        /// delegate is torn down under a live sheet leaves that sheet driving a dead view. In
        /// that case the pool marks itself dead and `release` does the destroying, so the view
        /// is never leaked either.
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
