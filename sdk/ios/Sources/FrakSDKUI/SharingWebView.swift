#if canImport(UIKit)
    import SwiftUI
    import WebKit

    /// What the hosted page can tell the host. `code` carries a value, which every other
    /// action deliberately does not — permitted only because this navigation is cancelled
    /// below and never reaches the OS.
    enum SharingPageAction: Equatable {
        case install
        case dismiss
        case shareAgain
        /// The page's own Share button. An ask, not a report: the interaction a share earns has
        /// to be signed by the SDK keypair the page has no access to. The page draws the
        /// button, the host performs it.
        case share
        /// The page's own Copy button. Same division as `share`.
        case copy
        case error
        /// The page has painted.
        ///
        /// Not an outcome — the only action here that reports progress rather than a user's
        /// decision. It is also the *only* paint signal iOS has: WebKit exposes no public
        /// equivalent of Android's `postVisualStateCallback`, and `didFinish` for a React app
        /// is still a blank frame. Load-bearing beyond the skeleton, too: a fragment
        /// activation is a same-document navigation, for which WebKit fires no `didFinish` at
        /// all, so without this the fastest path would be the one that times out at 1.5s.
        case ready
        case code(value: String, expiresAt: Date?)

        /// Unknown actions are nil, not a failure: a no-op is the forward-compatible answer
        /// when the page ships a new one before the SDK that reads it.
        static func from(action: String, value: String?, exp: String?) -> SharingPageAction? {
            switch action {
            case "install": return .install
            case "dismiss": return .dismiss
            case "shareAgain": return .shareAgain
            case "share": return .share
            case "copy": return .copy
            case "error": return .error
            case "ready": return .ready
            case "code":
                // A code action with no code is not one; treat it as unknown.
                guard let value, !value.isEmpty else { return nil }
                // `Int64`, not `Double`: has to agree with Kotlin's `toLongOrNull`, which
                // rejects "NaN"/"inf", or the same wire value yields a different expiry per platform.
                let expiresAt = exp.flatMap(Int64.init).map {
                    Date(timeIntervalSince1970: TimeInterval($0))
                }
                return .code(value: value, expiresAt: expiresAt)
            default: return nil
            }
        }
    }

    /// One sheet's worth of wiring for a `SharingWebView`.
    ///
    /// Split from the view so a view can outlive a sheet: `SharingWebViewPool` boots one
    /// against the wallet origin long before any session exists, and the sheet binds its own
    /// session onto that already-warm view at present time. Rebinding also resets the view's
    /// per-load state, so a retry consumed by the warm load cannot count against the real one.
    struct SharingWebViewBinding {
        let sessionId: String
        let onAction: (SharingPageAction) -> Void
        let onPageReady: () -> Void
        let onLoadFailed: () -> Void
        let onOpenExternal: (URL) -> Void

        init(
            sessionId: String,
            onAction: @escaping (SharingPageAction) -> Void = { _ in },
            onPageReady: @escaping () -> Void = {},
            onLoadFailed: @escaping () -> Void = {},
            onOpenExternal: @escaping (URL) -> Void = { _ in }
        ) {
            self.sessionId = sessionId
            self.onAction = onAction
            self.onPageReady = onPageReady
            self.onLoadFailed = onLoadFailed
            self.onOpenExternal = onOpenExternal
        }

        /// What an unpresented, warm view carries. `SharingPageURL.warmSessionId` can never
        /// satisfy a real sheet's `sid` guard, so a result navigation from the warm page is
        /// dropped rather than attributed to whichever session binds next.
        /// Computed, not a stored static: the callbacks make this type non-`Sendable`, and a
        /// shared instance of it would be global mutable state under strict concurrency.
        static var warm: SharingWebViewBinding { SharingWebViewBinding(sessionId: SharingPageURL.warmSessionId) }
    }

    /// The web view the sheet loads the hosted page in, and the navigation policy that is
    /// its only channel back to the host.
    ///
    /// No JavaScript bridge, ever — no `WKScriptMessageHandler`, no injected script. The
    /// page reports by navigating to `returnScheme://result?sid=…&action=…`, which is
    /// intercepted here and never allowed to leave the app.
    ///
    /// Whose session it is serving is `binding`, which the pool swaps at present time; the
    /// origin and return scheme are fixed for the view's life, since both come from the
    /// environment rather than from any one share.
    @MainActor
    final class SharingWebView: NSObject {
        let view: WKWebView

        private let origin: URL?
        private let returnScheme: String

        /// Whose session this view is currently serving. Setting it clears every per-load
        /// field below.
        private(set) var binding: SharingWebViewBinding

        /// The document `load(_:)` last pointed the view at, minus any fragment, or nil if it
        /// has never been pointed anywhere.
        ///
        /// What makes a same-document activation decidable: hanging a fragment off a URL is
        /// only free if that URL is the one already loaded. Tracked here rather than read back
        /// from `WKWebView.url`, which reports the *committed* URL and so still answers with
        /// the previous page for the whole of a load in flight — exactly the window this is
        /// consulted in.
        private(set) var loadedBaseURL: String?

        /// Whether `loadedBaseURL` actually finished loading.
        ///
        /// Load-bearing, not diagnostic. Warming is usually still in flight when the user taps,
        /// and hanging a fragment off a half-loaded document would leave the page stuck exactly
        /// where it got to — a fragment change starts no request, so nothing would ever finish
        /// it. A session that cannot activate must do a full load instead.
        ///
        /// Only meaningful while the pool owns the view. Once lent, the session drives the view
        /// directly and this stops tracking it; the pool reloads from scratch on release anyway.
        private(set) var documentReady = false

        /// The last main-frame URL asked for, so a cache-only retry has something to retry.
        private var requested: URL?
        /// At most one retry per binding.
        private var retried = false
        /// Set between issuing the retry and it starting, so the duplicate failure callbacks
        /// of the *original* load are not read as the retry having failed too.
        private var retryPending = false
        /// `onLoadFailed` is called at most once per binding.
        private var settled = false
        /// Set when the in-flight main-frame navigation fails or returns an HTTP error, so the
        /// `didFinish` WebKit still delivers for the error document is not read as a load.
        private var navigationFailed = false

        /// Whether the navigation in flight was started under the current binding.
        ///
        /// A pooled view is bound mid-flight — the warm load is usually still running when the
        /// user taps. Its `didFinish` would otherwise read as the *session's* page settling,
        /// which cancels the tier-3 deadline and lifts the skeleton onto the warm page; its
        /// failure would read as the session's page failing and fire the native share fallback.
        /// Cleared on bind, set by the next `didStartProvisionalNavigation`.
        private var navigationOwnedByBinding = false

        init(
            walletOrigin: String,
            returnScheme: String,
            binding: SharingWebViewBinding = .warm
        ) {
            let configuration = WKWebViewConfiguration()
            // Persistent: the hosted page's own HTTP cache is what tier 2 falls back on.
            configuration.websiteDataStore = .default()
            configuration.preferences.javaScriptCanOpenWindowsAutomatically = false

            self.view = WKWebView(frame: .zero, configuration: configuration)
            self.origin = URL(string: walletOrigin)
            self.returnScheme = returnScheme
            self.binding = binding
            super.init()

            view.allowsLinkPreview = false
            view.allowsBackForwardNavigationGestures = false
            view.isOpaque = false
            view.backgroundColor = .clear
            view.navigationDelegate = self
        }

        /// Points the view at a session. Resets per-load state; see `SharingWebViewBinding`.
        func bind(_ binding: SharingWebViewBinding) {
            self.binding = binding
            requested = nil
            retried = false
            retryPending = false
            settled = false
            navigationFailed = false
            navigationOwnedByBinding = false
        }

        /// A full navigation. Fragment activations do not come through here — see `navigate(_:)`.
        ///
        /// - Parameters:
        ///   - url: where to navigate.
        ///   - baseURL: the string the caller built, when it has one. `loadedBaseURL` is compared
        ///     with `==` against `SharingSession.warmBaseURL`, which is an unmodified
        ///     `SharingPageURL.warm(...)` result — so deriving this side from `URL.absoluteString`
        ///     instead would make the whole activation path rest on `URL(string:)` round-tripping a
        ///     string unchanged, which is Foundation's observed behaviour rather than its contract.
        ///     Android compares two raw substrings of the same request string for the same reason.
        func load(_ url: URL, baseURL: String? = nil) {
            loadedBaseURL = (baseURL ?? url.absoluteString).components(separatedBy: "#")[0]
            documentReady = false
            requested = url
            view.load(URLRequest(url: url))
        }

        /// Called by the owner when this view's document reports itself finished.
        func onDocumentReady() {
            documentReady = true
        }

        /// Performs a `SharingNavigation`.
        ///
        /// The activation case reads `WKWebView.url` rather than using the URL we warmed the
        /// view with, and that is the whole point: the sharing page's router normalises its own
        /// search params on load (`native=1` becomes `native=true`, an absent `confirmed`
        /// becomes `confirmed=false`), so by the time anyone taps, the document has moved
        /// somewhere we never named. Hanging the fragment off our string misses by exactly that
        /// much and reloads the whole page.
        ///
        /// Against the committed URL, `WKWebView.load` differs only in the fragment, which
        /// WebKit's `FrameLoader::loadWithDocumentLoader` routes through
        /// `shouldPerformFragmentNavigation`: no request, no remount, no React boot, and a
        /// `hashchange` for the page to read. It also means no `didFinish` — WebKit reports a
        /// same-document navigation separately — which is why `SharingPageAction.ready` and not
        /// `onPageReady` is what settles the tier-3 deadline on this path.
        func navigate(_ navigation: SharingNavigation) {
            switch navigation {
            case .load(let url):
                load(url)
            case .activate(let fragment, let fullURL):
                guard
                    let committed = view.url?.absoluteString.components(separatedBy: "#")[0],
                    let target = URL(string: committed + fragment)
                else {
                    // No committed URL means there is no document to hang a fragment off. The
                    // caller's `documentReady` guard should make this unreachable; load the page
                    // rather than leave the sheet on a skeleton if it ever is not.
                    load(fullURL)
                    return
                }
                // Deliberately not through `load(_:)`: this is the same document, so
                // `loadedBaseURL` and `documentReady` must keep describing it, and `requested`
                // must keep pointing at the last thing a cache-only retry could retry — a
                // fragment change is not one.
                view.load(URLRequest(url: target))
            }
        }

        /// Stops whatever is in flight and leaves the view reusable. What the pool calls when
        /// it takes a view back.
        func stopLoading() {
            view.stopLoading()
        }

        /// Retires the view for good. Unlike `stopLoading`, the delegate is dropped, so nothing
        /// this view does afterwards can reach a binding.
        func destroy() {
            view.navigationDelegate = nil
            view.stopLoading()
        }

        /// Component by component, never a prefix match: `wallet.frak.id.attacker.example`
        /// starts with the origin string but is not it.
        private func isSameOrigin(_ url: URL) -> Bool {
            guard let origin else { return false }
            return url.scheme == origin.scheme
                && url.host?.caseInsensitiveCompare(origin.host ?? "") == .orderedSame
                && url.port == origin.port
        }

        private func queryValue(_ url: URL, _ name: String) -> String? {
            URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?
                .first { $0.name == name }?
                .value
        }

        private func handleMainFrameFailure() {
            // The warm load failing after this view was lent to a sheet. Falling back here would
            // raise a native chooser over a sheet whose own page has not been tried yet.
            guard navigationOwnedByBinding else { return }
            // Before the `settled` guard: a reload that fails after tier 3 has already fired
            // still gets an error document, whose `didFinish` must not report readiness.
            navigationFailed = true
            guard !settled else { return }
            guard !retryPending else { return }
            guard !retried, let requested else {
                settled = true
                binding.onLoadFailed()
                return
            }
            // Tier 2: the document may still be in the HTTP cache with no network.
            retried = true
            retryPending = true
            view.load(URLRequest(url: requested, cachePolicy: .returnCacheDataDontLoad))
        }

        /// A navigation this code cancelled, which WebKit reports as a load failure. Reading
        /// it as one would fire the tier-3 fallback every time the page reports a result.
        private func isCancellation(_ error: any Error) -> Bool {
            let error = error as NSError
            if error.domain == NSURLErrorDomain, error.code == NSURLErrorCancelled { return true }
            // `WebKitErrorFrameLoadInterruptedByPolicyChange` — legacy domain and code, with no
            // symbol in `WKError`. What a `.cancel` decision surfaces as.
            return error.domain == "WebKitErrorDomain" && error.code == 102
        }
    }

    extension SharingWebView: WKNavigationDelegate {
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            // A sub-frame must not be launched externally — that would let an embedded frame
            // yank the user out of the sheet — and a cross-origin one is cancelled rather than
            // rendered, since a full-bleed foreign frame in a sheet with no URL bar would be
            // indistinguishable from the real page. Only remote schemes are judged: `about:blank`,
            // `srcdoc`, `blob:` and `data:` frames have no host to compare and are routine inside
            // a React page.
            if let frame = navigationAction.targetFrame, !frame.isMainFrame {
                let remote = url.scheme == "https" || url.scheme == "http"
                // The return scheme carries a capability value (`action=code`), so it is
                // cancelled outright from a sub-frame, never merely left unhandled — this
                // navigation must provably never reach the OS.
                if url.scheme == returnScheme {
                    decisionHandler(.cancel)
                    return
                }
                decisionHandler(remote && !isSameOrigin(url) ? .cancel : .allow)
                return
            }

            // A nil `targetFrame` is a new window, not a sub-frame: `target="_blank"` and
            // gesture-driven `window.open` both produce one, and neither is stopped by
            // `javaScriptCanOpenWindowsAutomatically = false`. With no `WKUIDelegate`, `.allow`
            // would drop it silently, so this loads it in the current frame instead and lets a
            // foreign one fall through to the browser below.
            if navigationAction.targetFrame == nil, isSameOrigin(url) {
                webView.load(navigationAction.request)
                decisionHandler(.cancel)
                return
            }

            if url.scheme == returnScheme, url.host == SharingPageURL.resultHost {
                // A result from a sheet the user already closed carries a stale session id, and
                // so does one from the warm page, whose id no sheet can ever hold.
                if queryValue(url, "sid") == binding.sessionId,
                    let name = queryValue(url, "action"),
                    let action = SharingPageAction.from(
                        action: name,
                        value: queryValue(url, "value"),
                        exp: queryValue(url, "exp")
                    )
                {
                    binding.onAction(action)
                }
                decisionHandler(.cancel)
                return
            }

            if isSameOrigin(url) {
                decisionHandler(.allow)
                return
            }

            // Anything else — the merchant's own site, a social network, a wallet — belongs in
            // the browser, not inside a sheet the user cannot navigate.
            binding.onOpenExternal(url)
            decisionHandler(.cancel)
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            retryPending = false
            navigationFailed = false
            navigationOwnedByBinding = true
        }

        /// Android's `onReceivedHttpError` equivalent: without this the main-frame status code
        /// is never inspected, and a 5xx that returns a body reaches `didFinish` as a normal load.
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationResponse: WKNavigationResponse,
            decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
        ) {
            guard navigationResponse.isForMainFrame,
                let http = navigationResponse.response as? HTTPURLResponse,
                !(200..<400).contains(http.statusCode)
            else {
                decisionHandler(.allow)
                return
            }
            // `.allow`, not `.cancel`: cancelling surfaces as a cancellation error, which
            // `isCancellation` filters out, so neither path would fire. `navigationFailed`
            // suppresses the `didFinish` that follows.
            decisionHandler(.allow)
            handleMainFrameFailure()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // The warm load landing after this view was lent to a sheet. Not this session's page.
            guard navigationOwnedByBinding else { return }
            guard !navigationFailed else { return }
            binding.onPageReady()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
            guard !isCancellation(error) else { return }
            handleMainFrameFailure()
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: any Error
        ) {
            guard !isCancellation(error) else { return }
            handleMainFrameFailure()
        }

        /// A jetsammed content process leaves a blank view and fires nothing else. Tier 3 has a
        /// working local link; reloading would mean re-running the content that just crashed it.
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            // Unconditional, and ahead of the `settled` guard: a jetsammed renderer leaves nothing
            // on screen, so a document this view still claims to have finished is a lie. An idle
            // pooled view is the common case here — iOS reclaims content processes under memory
            // pressure, and a warm view nobody is looking at is a prime candidate — and without
            // this the next sheet would read `documentReady` as true, activate by fragment into a
            // dead renderer and skip the skeleton over a blank sheet.
            documentReady = false
            guard !settled else { return }
            settled = true
            binding.onLoadFailed()
        }
    }

    /// Puts an already-built `SharingWebView` on screen. Owned by the sheet's model, not by
    /// SwiftUI, because the model has to reload it after a share.
    struct SharingWebViewContainer: UIViewRepresentable {
        let webView: SharingWebView

        func makeUIView(context: Context) -> WKWebView {
            webView.view
        }

        func updateUIView(_ uiView: WKWebView, context: Context) {}
    }
#endif
