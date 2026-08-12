#if canImport(UIKit)
    import SwiftUI
    import WebKit

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

        /// Jetsammed content process, not loaded since. WebKit gives the view a new process on the
        /// next load, so this only tells `SharingWebViewPool` its warm URL is stale.
        private(set) var rendererGone = false

        /// The last main-frame URL asked for, so a retry has something to retry.
        private var requested: URL?
        /// Rungs of `retryLadder` already spent on the document in `ladderURL`.
        private var retryCount = 0
        /// Which document the spent rungs belong to. A session navigates more than once — the
        /// install page, and the confirmation screen — and a fresh document has not failed yet.
        private var ladderURL: URL?
        /// The scheduled retry, held so a rebind can cancel one that would navigate the next
        /// session's view.
        private var pendingRetry: Task<Void, Never>?
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

            // Screen-sized, not `.zero`: a warm view is never in a window, and at 0x0 the page's
            // whole first layout — every `innerWidth`, media query and container query — is made
            // against a degenerate viewport it then has to recover from when the sheet shows it.
            self.view = WKWebView(frame: Self.warmFrame(), configuration: configuration)
            self.origin = URL(string: walletOrigin)
            self.returnScheme = returnScheme
            self.binding = binding
            super.init()

            view.allowsLinkPreview = false
            view.allowsBackForwardNavigationGestures = false
            view.isOpaque = false
            view.backgroundColor = .clear
            view.navigationDelegate = self
            #if DEBUG
                if #available(iOS 16.4, *) {
                    // The hosted page is the one part of the sheet that can fail silently.
                    view.isInspectable = true
                }
            #endif

            // The view fills the sheet, home indicator included, and the page insets its own
            // footer from `env(safe-area-inset-bottom)`. Any other behaviour insets the document
            // by that same safe area, leaving the sheet showing through under the page.
            view.scrollView.contentInsetAdjustmentBehavior = .never
            // The document never scrolls — the page scrolls a child of its own — so a bounce here
            // is only a rubber-band competing with the sheet's drag.
            view.scrollView.bounces = false
        }

        /// A plausible viewport for a view that is not in a window yet. The constant is a
        /// mid-range iPhone; only its non-degeneracy matters, since the sheet resizes the view.
        private static func warmFrame() -> CGRect {
            let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
            return scene?.screen.bounds ?? CGRect(x: 0, y: 0, width: 390, height: 844)
        }

        /// Points the view at a session. Resets per-load state; see `SharingWebViewBinding`.
        func bind(_ binding: SharingWebViewBinding) {
            self.binding = binding
            // Before the counters: a retry booked by the previous session would otherwise navigate
            // this view to that session's URL, on a pool that has already moved on.
            cancelPendingRetry()
            requested = nil
            retryCount = 0
            ladderURL = nil
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
        /// `WKWebView.url` rather than off the URL we warmed with, so it stays correct if the two
        /// ever diverge. A fragment-only load fires no `didFinish`.
        func navigate(_ navigation: SharingNavigation) {
            switch navigation {
            case .load(let url):
                load(url)
            case .activate(let fragment, let fullURL):
                guard let target = fragmentTarget(fragment) else {
                    // No committed URL means no document to hang a fragment off; load the page.
                    load(fullURL)
                    return
                }
                // Not through `load(_:)`: same document, so `loadedBaseURL`, `documentReady` and
                // `requested` must keep describing it.
                view.load(URLRequest(url: target))
            }
        }

        /// Puts this view's page back to its warm params after a session moved them. Same document,
        /// so `loadedBaseURL` and `documentReady` keep describing it and the next session can
        /// activate on top instead of loading.
        func resetToWarm() {
            guard let target = fragmentTarget(SharingPageURL.warmFragment) else { return }
            view.load(URLRequest(url: target))
        }

        /// `fragment` hung off whatever document is committed, or nil when there is none.
        private func fragmentTarget(_ fragment: String) -> URL? {
            guard let committed = view.url?.absoluteString.components(separatedBy: "#")[0] else {
                return nil
            }
            return URL(string: committed + fragment)
        }

        func stopLoading() {
            view.stopLoading()
        }

        /// Retires the view for good: the delegate is dropped, so nothing can reach a binding after.
        func destroy() {
            // The pool reaches here without rebinding — a dead pool releasing a lent view, or
            // destroying a warm one — so the binding's own cancellation does not cover it, and a
            // booked retry would keep the view alive to load a page nobody will see.
            cancelPendingRetry()
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
            sharingQueryValue(url, name)
        }

        /// A main-frame failure gets the rest of `retryLadder` before tier 3. Every rung is a
        /// network rung: the hosted document is served `no-store`, so it is never in the HTTP
        /// cache and a cache-only attempt cannot answer.
        ///
        /// - Parameter unreachable: the network itself did not answer, so another attempt over it
        ///   is pointless and there is no cached copy to read instead — tier 3 now.
        private func handleMainFrameFailure(unreachable: Bool) {
            // The warm load failing after this view was lent to a sheet: not the sheet's page.
            guard navigationOwnedByBinding else { return }
            // Before the `settled` guard: a later error document's `didFinish` must not report readiness.
            navigationFailed = true
            guard !settled else { return }
            // Duplicate callback for the failure that already booked the next rung.
            guard !retryPending else { return }
            guard let requested else {
                giveUp()
                return
            }
            // A document this ladder has not been spent on yet gets the whole thing.
            if requested != ladderURL {
                ladderURL = requested
                retryCount = 0
            }
            guard !unreachable, retryCount < Self.retryLadder.count else {
                giveUp()
                return
            }
            let delay = Self.retryLadder[retryCount]
            retryCount += 1
            retryPending = true
            scheduleRetry(after: delay) { [weak self] in
                guard let self else { return }
                view.load(URLRequest(url: requested, cachePolicy: .useProtocolCachePolicy))
            }
        }

        /// The ladder is spent.
        private func giveUp() {
            settled = true
            binding.onLoadFailed()
        }

        private func scheduleRetry(
            after delay: TimeInterval,
            _ navigate: @escaping @MainActor () -> Void
        ) {
            cancelPendingRetry()
            pendingRetry = Task { @MainActor [weak self] in
                if delay > 0 {
                    try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
                // Outside the delay branch on purpose: `Task.cancel()` is cooperative, and the
                // undelayed rung is the one most likely to race a rebind. A `Task` does not run
                // inline, so a synchronous `bind()` on the same turn can cancel this before it
                // starts — and without this check it would navigate a view the pool reassigned.
                guard !Task.isCancelled else { return }
                self?.pendingRetry = nil
                self?.retryPending = false
                navigate()
            }
        }

        private func cancelPendingRetry() {
            pendingRetry?.cancel()
            pendingRetry = nil
        }

        /// The network itself did not answer, so another attempt over it is pointless.
        private func isUnreachable(_ error: any Error) -> Bool {
            let error = error as NSError
            guard error.domain == NSURLErrorDomain else { return false }
            return error.code == NSURLErrorNotConnectedToInternet
                || error.code == NSURLErrorCannotFindHost
                || error.code == NSURLErrorCannotConnectToHost
                || error.code == NSURLErrorDNSLookupFailed
        }

        /// Delays a main-frame failure gets before tier 3, in order. Two rungs, sized to fit
        /// inside the sheet's own load budget alongside the attempts themselves.
        private static let retryLadder: [TimeInterval] = [0.3, 0.9]

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
                        exp: queryValue(url, "exp"),
                        shareTitle: queryValue(url, "title"),
                        shareText: queryValue(url, "text"),
                        shareImage: queryValue(url, "image")
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
            // An answer, however bad, means the network is there; this is the retryable kind.
            handleMainFrameFailure(unreachable: false)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // The warm load landing after this view was lent to a sheet. Not this session's page.
            guard navigationOwnedByBinding else { return }
            guard !navigationFailed else { return }
            binding.onPageReady()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
            guard !isCancellation(error) else { return }
            handleMainFrameFailure(unreachable: isUnreachable(error))
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: any Error
        ) {
            guard !isCancellation(error) else { return }
            handleMainFrameFailure(unreachable: isUnreachable(error))
        }

        /// A jetsammed content process leaves a blank view and fires nothing else.
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            // Ahead of the `settled` guard: a jetsammed renderer leaves nothing on screen, so a
            // pooled view still claiming `documentReady` would activate into a dead renderer.
            documentReady = false
            // Tells the pool its warm URL describes nothing on screen.
            rendererGone = true
            // A booked retry would only navigate a view with nothing behind it.
            cancelPendingRetry()
            guard !settled else { return }
            settled = true
            binding.onLoadFailed()
        }
    }

    /// Puts an already-built `SharingWebView` on screen; the sheet's model owns it, not SwiftUI.
    struct SharingWebViewContainer: UIViewRepresentable {
        let webView: SharingWebView
        /// Called once SwiftUI has actually taken this view out of the hierarchy — not from
        /// `onDismiss`, which still has frames to draw and would empty the closing sheet.
        let onDismantled: () -> Void

        func makeCoordinator() -> Coordinator {
            Coordinator(onDismantled: onDismantled)
        }

        /// The engine itself, not a host wrapping it: SwiftUI builds this representable twice when
        /// `SharingPresenter.presentation` swaps, and a host would have to *move* the engine into
        /// the second one, leaving the on-screen first one empty.
        func makeUIView(context: Context) -> WKWebView {
            return webView.view
        }

        func updateUIView(_ uiView: WKWebView, context: Context) {}

        static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
            coordinator.onDismantled()
        }

        /// Carries the callback, which `dismantleUIView` cannot reach any other way — it is
        /// static, and the representable value is gone by the time it runs.
        final class Coordinator {
            let onDismantled: () -> Void

            init(onDismantled: @escaping () -> Void) {
                self.onDismantled = onDismantled
            }
        }
    }
#endif
