#if canImport(UIKit)
    import SwiftUI
    import WebKit

    /// What the hosted page can tell the host, over the intercepted return-scheme navigation.
    enum SharingPageAction: Hashable {
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

        /// Puts this view's page back to its warm params after a session moved them.
        ///
        /// Same document, so `loadedBaseURL` and `documentReady` keep describing it and the next
        /// session can still activate on top instead of loading. A no-op when there is no
        /// committed document to reset, which is the correct answer — `SharingWebViewPool.release`
        /// only reaches here for a view whose document is the warm one.
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
            URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?
                .first { $0.name == name }?
                .value
        }

        /// A main-frame failure gets the rest of `retryLadder` before tier 3. Network rungs first,
        /// because a transient failure is what a retry is for; the cache-only rung last, which is
        /// the only thing that can answer for a device that went offline on a page it has seen.
        ///
        /// - Parameter unreachable: the network itself did not answer, so another attempt over it
        ///   is pointless and the ladder jumps straight to its cache-only rung.
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
            if unreachable { retryCount = max(retryCount, Self.retryLadder.count - 1) }
            guard retryCount < Self.retryLadder.count else {
                giveUp()
                return
            }
            let rung = Self.retryLadder[retryCount]
            retryCount += 1
            retryPending = true
            // Undelayed when nothing is reachable: the cache answers or it does not, and the sheet
            // is holding a skeleton over this either way.
            scheduleRetry(after: unreachable ? 0 : rung.delay) { [weak self] in
                guard let self else { return }
                let policy: URLRequest.CachePolicy = rung.cacheOnly ? .returnCacheDataDontLoad : .useProtocolCachePolicy
                view.load(URLRequest(url: requested, cachePolicy: policy))
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

        /// One rung of `retryLadder`: how long to wait, and what to let the attempt read.
        private struct Rung {
            let delay: TimeInterval
            let cacheOnly: Bool
        }

        /// What a main-frame failure gets before tier 3. Two rungs, sized to fit inside the
        /// sheet's own load budget alongside the attempts themselves.
        private static let retryLadder = [
            Rung(delay: 0.3, cacheOnly: false),
            Rung(delay: 0.9, cacheOnly: true),
        ]

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
            // Tells the pool its warm URL no longer describes anything on screen.
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
        /// Called once SwiftUI has actually taken this view out of the hierarchy.
        ///
        /// The pooled view goes back on this rather than on `SharingPresentation.dispose`, which
        /// runs from `onDismiss` — while the sheet still has frames to draw. `SharingWebViewPool
        /// .release` detaches the view and resets it, and `updateUIView` never puts it back, so
        /// reclaiming it there empties the closing sheet mid-animation: a transparent hole, since
        /// the sheet's own background is cleared for the page to show through.
        let onDismantled: () -> Void

        func makeCoordinator() -> Coordinator {
            Coordinator(onDismantled: onDismantled)
        }

        /// The engine itself, not a host wrapping it.
        ///
        /// A wrapper was tried and reverted: SwiftUI builds this representable twice in the update
        /// that swaps `SharingPresenter.presentation`, and a wrapper has to *move* the engine into
        /// the second host, leaving the first — the one left on screen — empty, which shows as a
        /// transparent sheet. Returning the engine is idempotent under that double build. Swapping
        /// between two engines is handled by identity instead: `PresentedSharingSession` carries
        /// `.id(ObjectIdentifier(presentation))`, so a new session builds a new representable here
        /// rather than inheriting the previous one's answer.
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
