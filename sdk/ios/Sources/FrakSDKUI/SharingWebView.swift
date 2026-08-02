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
            guard !settled, !retryPending else { return }
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
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
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
