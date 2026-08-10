#if canImport(UIKit)
    import SwiftUI
    import WebKit

    /// What the hosted page can tell the host, over the intercepted return-scheme navigation.
    enum SharingPageAction: Equatable {
        case install
        case dismiss
        case shareAgain
        /// The page's own Share button — an ask, not a report: the host signs the interaction.
        case share
        case copy
        case error
        /// The page has painted. iOS's only paint signal: WebKit exposes no public
        /// `postVisualStateCallback`, and a fragment activation fires no `didFinish` at all.
        case ready
        case code(value: String, expiresAt: Date?)

        /// Unknown actions are nil, not a failure: the page may ship one before the SDK reads it.
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
                guard let value, !value.isEmpty else { return nil }
                // `Int64`, not `Double`: has to agree with Kotlin's `toLongOrNull`, which rejects
                // "NaN"/"inf".
                let expiresAt = exp.flatMap(Int64.init).map {
                    Date(timeIntervalSince1970: TimeInterval($0))
                }
                return .code(value: value, expiresAt: expiresAt)
            default: return nil
            }
        }
    }

    /// One sheet's worth of wiring for a `SharingWebView`. Split from the view so a pooled view
    /// can outlive a sheet; rebinding also resets the view's per-load state.
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

        /// What an unpresented, warm view carries: `warmSessionId` can never satisfy a real
        /// sheet's `sid` guard. Computed, since the callbacks make this type non-`Sendable`.
        static var warm: SharingWebViewBinding { SharingWebViewBinding(sessionId: SharingPageURL.warmSessionId) }
    }

    /// The web view the sheet loads the hosted page in, and the navigation policy that is its
    /// only channel back to the host. No JavaScript bridge: the page reports by navigating to
    /// `returnScheme://result?sid=…&action=…`, intercepted here and never allowed to leave the app.
    @MainActor
    final class SharingWebView: NSObject {
        let view: WKWebView

        private let origin: URL?
        private let returnScheme: String

        private(set) var binding: SharingWebViewBinding

        /// The document `load(_:)` last pointed at, minus any fragment. Tracked here rather than
        /// read from `WKWebView.url`, which reports the committed URL and so lags a load in flight.
        private(set) var loadedBaseURL: String?

        /// Whether `loadedBaseURL` finished loading. A fragment change starts no request, so
        /// activating on top of a half-loaded document would leave the page stuck where it got to.
        private(set) var documentReady = false

        /// This view's content process was jetsammed and it has not been loaded since. Unlike
        /// Android, where a dead renderer finishes a `WebView` for good, WebKit gives the view a
        /// new process on the next load — so this only tells `SharingWebViewPool` that its idea
        /// of what is warmed is stale.
        private(set) var rendererGone = false

        /// The last main-frame URL asked for, so a cache-only retry has something to retry.
        private var requested: URL?
        /// At most one retry per binding.
        private var retried = false
        /// Set between issuing the retry and it starting, so the original load's duplicate
        /// failure callbacks are not read as the retry failing too.
        private var retryPending = false
        /// `onLoadFailed` is called at most once per binding.
        private var settled = false
        /// Set when the in-flight main-frame navigation fails, so the `didFinish` WebKit still
        /// delivers for the error document is not read as a load.
        private var navigationFailed = false

        /// Whether the navigation in flight was started under the current binding. A pooled view
        /// is bound mid-flight, so the warm load's `didFinish` or failure must not reach the sheet.
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

            // The view fills the sheet, home indicator included, and the page insets its own
            // footer from `env(safe-area-inset-bottom)`. Any other behaviour insets the document
            // by that same safe area, leaving the sheet showing through under the page.
            view.scrollView.contentInsetAdjustmentBehavior = .never
            // The document never scrolls — the page scrolls a child of its own — so a bounce here
            // is only a rubber-band competing with the sheet's drag.
            view.scrollView.bounces = false
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

        /// A full navigation; fragment activations go through `navigate(_:)` instead.
        ///
        /// - Parameters:
        ///   - url: the address to load.
        ///   - baseURL: the caller's own string, compared with `==` against
        ///     `SharingSession.warmBaseURL`, so it must not rely on `URL(string:)` round-tripping.
        func load(_ url: URL, baseURL: String? = nil) {
            loadedBaseURL = (baseURL ?? url.absoluteString).components(separatedBy: "#")[0]
            documentReady = false
            // This load is what gives a jetsammed view its new content process back.
            rendererGone = false
            requested = url
            view.load(URLRequest(url: url))
        }

        func onDocumentReady() {
            documentReady = true
        }

        /// Performs a `SharingNavigation`. The activation case hangs its fragment off
        /// `WKWebView.url`, not off the URL we warmed with: the page's router rewrites its own
        /// search params on load. A fragment-only load fires no `didFinish`.
        func navigate(_ navigation: SharingNavigation) {
            switch navigation {
            case .load(let url):
                load(url)
            case .activate(let fragment, let fullURL):
                guard
                    let committed = view.url?.absoluteString.components(separatedBy: "#")[0],
                    let target = URL(string: committed + fragment)
                else {
                    // No committed URL means no document to hang a fragment off; load the page.
                    load(fullURL)
                    return
                }
                // Not through `load(_:)`: same document, so `loadedBaseURL`, `documentReady` and
                // `requested` must keep describing it.
                view.load(URLRequest(url: target))
            }
        }

        func stopLoading() {
            view.stopLoading()
        }

        /// Retires the view for good: the delegate is dropped, so nothing can reach a binding after.
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
            // The warm load failing after this view was lent to a sheet: not the sheet's page.
            guard navigationOwnedByBinding else { return }
            // Before the `settled` guard: a later error document's `didFinish` must not report readiness.
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

        /// A navigation this code cancelled, which WebKit reports as a load failure.
        private func isCancellation(_ error: any Error) -> Bool {
            let error = error as NSError
            if error.domain == NSURLErrorDomain, error.code == NSURLErrorCancelled { return true }
            // `WebKitErrorFrameLoadInterruptedByPolicyChange`: legacy domain and code, no symbol
            // in `WKError`. What a `.cancel` decision surfaces as.
            return error.domain == "WebKitErrorDomain" && error.code == 102
        }
    }

    extension SharingWebView: WKNavigationDelegate {
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            // Sub-frames are never launched externally, and a cross-origin one is cancelled rather
            // than rendered. Only remote schemes are judged — `about:`/`blob:`/`data:` have no host.
            if let frame = navigationAction.targetFrame, !frame.isMainFrame {
                let remote = url.scheme == "https" || url.scheme == "http"
                // The return scheme carries a capability value (`action=code`); cancel it outright,
                // never merely leave it unhandled.
                if url.scheme == returnScheme {
                    decisionHandler(.cancel)
                    return
                }
                decisionHandler(remote && !isSameOrigin(url) ? .cancel : .allow)
                return
            }

            // A nil `targetFrame` is a new window (`target="_blank"`, `window.open`), which
            // `javaScriptCanOpenWindowsAutomatically = false` does not stop and `.allow` would drop.
            if navigationAction.targetFrame == nil, isSameOrigin(url) {
                webView.load(navigationAction.request)
                decisionHandler(.cancel)
                return
            }

            if url.scheme == returnScheme, url.host == SharingPageURL.resultHost {
                // A stale sid: a closed sheet's result, or the warm page's, which no sheet holds.
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

            // Anything else belongs in the browser, not inside a sheet the user cannot navigate.
            binding.onOpenExternal(url)
            decisionHandler(.cancel)
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            retryPending = false
            navigationFailed = false
            navigationOwnedByBinding = true
        }

        /// Without this the main-frame status code is never inspected, and a 5xx that returns a
        /// body reaches `didFinish` as a normal load.
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationResponse: WKNavigationResponse,
            decisionHandler: @escaping @MainActor @Sendable (WKNavigationResponsePolicy) -> Void
        ) {
            guard navigationResponse.isForMainFrame,
                let http = navigationResponse.response as? HTTPURLResponse,
                !(200..<400).contains(http.statusCode)
            else {
                decisionHandler(.allow)
                return
            }
            // `.allow`, not `.cancel`: cancelling surfaces as a cancellation error that
            // `isCancellation` filters out. `navigationFailed` suppresses the `didFinish`.
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

        /// A jetsammed content process leaves a blank view and fires nothing else.
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            // Ahead of the `settled` guard: a jetsammed renderer leaves nothing on screen, so a
            // pooled view still claiming `documentReady` would activate into a dead renderer.
            documentReady = false
            // Tells the pool its warm URL no longer describes anything on screen.
            rendererGone = true
            guard !settled else { return }
            settled = true
            binding.onLoadFailed()
        }
    }

    /// Puts an already-built `SharingWebView` on screen; the sheet's model owns it, not SwiftUI.
    struct SharingWebViewContainer: UIViewRepresentable {
        let webView: SharingWebView

        func makeUIView(context: Context) -> WKWebView {
            webView.view
        }

        func updateUIView(_ uiView: WKWebView, context: Context) {}
    }
#endif
