#if canImport(UIKit)
    import SwiftUI
    import WebKit

    /// What the hosted page can tell the host.
    enum SharingPageAction: String {
        case install
        case dismiss
        case shareAgain
        case error
    }

    /// The web view the sheet loads the hosted page in, and the navigation policy that is
    /// its only channel back to the host.
    ///
    /// **No JavaScript bridge, ever** — no `WKScriptMessageHandler`, no injected script. The
    /// page reports by navigating to `returnScheme://result?sid=…&action=…`, which is
    /// intercepted here and never allowed to leave the app.
    @MainActor
    final class SharingWebView: NSObject {
        let view: WKWebView

        private let origin: URL?
        private let returnScheme: String
        private let sessionId: String
        private let onAction: (SharingPageAction) -> Void
        private let onPageReady: () -> Void
        private let onLoadFailed: () -> Void
        private let onOpenExternal: (URL) -> Void

        /// The last main-frame URL asked for, so a cache-only retry has something to retry.
        private var requested: URL?
        /// At most one retry per web view, even across a `shareAgain` reload.
        private var retried = false
        /// Set between issuing the retry and it starting, so the duplicate failure callbacks
        /// of the *original* load are not read as the retry having failed too.
        private var retryPending = false
        /// `onLoadFailed` is called at most once.
        private var settled = false
        /// Set when the in-flight main-frame navigation fails or returns an HTTP error, so the
        /// `didFinish` WebKit still delivers for the error document is not read as a load.
        private var navigationFailed = false

        init(
            walletOrigin: String,
            returnScheme: String,
            sessionId: String,
            onAction: @escaping (SharingPageAction) -> Void = { _ in },
            onPageReady: @escaping () -> Void = {},
            onLoadFailed: @escaping () -> Void = {},
            onOpenExternal: @escaping (URL) -> Void = { _ in }
        ) {
            let configuration = WKWebViewConfiguration()
            // Persistent, so the hosted page's own HTTP cache is what tier 2 falls back on.
            configuration.websiteDataStore = .default()
            configuration.preferences.javaScriptCanOpenWindowsAutomatically = false

            self.view = WKWebView(frame: .zero, configuration: configuration)
            self.origin = URL(string: walletOrigin)
            self.returnScheme = returnScheme
            self.sessionId = sessionId
            self.onAction = onAction
            self.onPageReady = onPageReady
            self.onLoadFailed = onLoadFailed
            self.onOpenExternal = onOpenExternal
            super.init()

            view.allowsLinkPreview = false
            view.allowsBackForwardNavigationGestures = false
            view.isOpaque = false
            view.backgroundColor = .clear
            view.navigationDelegate = self
        }

        func load(_ url: URL) {
            requested = url
            view.load(URLRequest(url: url))
        }

        func stop() {
            view.navigationDelegate = nil
            view.stopLoading()
        }

        /// Component by component, never a prefix match: `wallet.frak.id.attacker.example`
        /// starts with the origin and is not it.
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
            // Before the `settled` guard: a reload that fails after tier 3 has already fired still
            // gets an error document, whose `didFinish` must not report readiness.
            navigationFailed = true
            guard !settled else { return }
            guard !retryPending else { return }
            guard !retried, let requested else {
                settled = true
                onLoadFailed()
                return
            }
            // Tier 2: the document may still be in the HTTP cache even with no network.
            retried = true
            retryPending = true
            view.load(URLRequest(url: requested, cachePolicy: .returnCacheDataDontLoad))
        }

        /// A navigation this code cancelled, which WebKit reports as a load failure. Reading
        /// it as one would fire the tier-3 fallback every time the page reports a result.
        private func isCancellation(_ error: any Error) -> Bool {
            let error = error as NSError
            if error.domain == NSURLErrorDomain, error.code == NSURLErrorCancelled { return true }
            // `WebKitErrorFrameLoadInterruptedByPolicyChange`. Legacy domain and code, with no
            // symbol in `WKError` — this is what a `.cancel` decision surfaces as.
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

            // A sub-frame must not be launched externally — that would let an embedded frame yank
            // the user out of the sheet — and a cross-origin one is cancelled rather than
            // rendered, since a full-bleed foreign frame in a sheet with no URL bar is exactly the
            // indistinguishability the origin pinning exists to prevent. Only remote schemes are
            // judged: `about:blank`, `srcdoc`, `blob:` and `data:` frames have no host to compare
            // and are routine inside a React page.
            if let frame = navigationAction.targetFrame, !frame.isMainFrame {
                let remote = url.scheme == "https" || url.scheme == "http"
                decisionHandler(remote && !isSameOrigin(url) ? .cancel : .allow)
                return
            }

            // A nil `targetFrame` is a *new window*, not a sub-frame: `target="_blank"` and
            // gesture-driven `window.open` both produce one, and neither is stopped by
            // `javaScriptCanOpenWindowsAutomatically = false`. With no `WKUIDelegate`, `.allow`
            // would drop it silently. Android has no such case — setSupportMultipleWindows(false)
            // loads it in the current frame — so do the same here, and let a foreign one fall
            // through to the browser below.
            if navigationAction.targetFrame == nil, isSameOrigin(url) {
                webView.load(navigationAction.request)
                decisionHandler(.cancel)
                return
            }

            if url.scheme == returnScheme, url.host == SharingPageURL.resultHost {
                // A result from a sheet the user already closed carries a stale session id.
                if queryValue(url, "sid") == sessionId,
                    let action = queryValue(url, "action").flatMap(SharingPageAction.init(rawValue:))
                {
                    onAction(action)
                }
                decisionHandler(.cancel)
                return
            }

            if isSameOrigin(url) {
                decisionHandler(.allow)
                return
            }

            // The merchant's own site, a social network, a wallet: all belong in the browser,
            // not inside a sheet the user cannot navigate.
            onOpenExternal(url)
            decisionHandler(.cancel)
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            retryPending = false
            navigationFailed = false
        }

        /// Android's `onReceivedHttpError` equivalent. Without this the main-frame status code is
        /// never inspected, and a 5xx that returns a body reaches `didFinish` as a normal load.
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
            // `isCancellation` filters out, so neither path would fire. Letting WebKit finish
            // normally keeps one route in — this call — and `navigationFailed` suppresses the
            // `didFinish` that follows.
            decisionHandler(.allow)
            handleMainFrameFailure()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard !navigationFailed else { return }
            onPageReady()
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

        /// A jetsammed content process leaves a blank view and fires nothing else. Recovery would
        /// mean reloading the content that just killed a process; tier 3 has a working local link.
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            guard !settled else { return }
            settled = true
            onLoadFailed()
        }
    }

    /// Puts an already-built `SharingWebView` on screen. The view is owned by the sheet's
    /// model, not by SwiftUI, because the model has to reload it after a share.
    struct SharingWebViewContainer: UIViewRepresentable {
        let webView: SharingWebView

        func makeUIView(context: Context) -> WKWebView {
            webView.view
        }

        func updateUIView(_ uiView: WKWebView, context: Context) {}
    }
#endif
