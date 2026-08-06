#if canImport(UIKit)
    import Foundation
    import FrakSDK
    import StoreKit
    import SwiftUI
    import UIKit

    // `SharingSession`, `SharingNavigation` and `sharingDecision` live in SharingSheetLogic.swift,
    // outside this `#if`, so they stay reachable from a macOS test host.

    /// The sheet's behaviour, kept out of the view. Ordering matters — attribute the share
    /// after the OS chooser, confirm after that, never fall back twice.
    @MainActor
    final class SharingSheetModel: ObservableObject {
        /// Tap-to-content budget, timed from the tap: it has to cover `buildSharingLink` and
        /// `resolveConfig` too.
        static let pageLoadDeadline: TimeInterval = 1.5
        /// How long the reward headline may delay the page navigation. Sized for a cache hit and
        /// nothing more; a miss costs nothing, since the page fetches the same value itself.
        nonisolated static let seedTimeout: TimeInterval = 0.04
        private static let appStoreHost = "apps.apple.com"
        /// `SKOverlay` wants the bare numeric id, not a URL.
        private static let walletAppStoreId = "6740261164"

        /// Whether the hosted page has painted; drives the skeleton over the web view. Latches,
        /// and starts true when this sheet was handed a finished warm page.
        @Published private(set) var pageVisible: Bool

        /// Document-finished. Observable so the sheet can bound its skeleton's wait.
        @Published private(set) var pageLoaded = false

        /// Every outcome as it happens; the caller keeps the most significant.
        var onOutcome: ((SharingResult) -> Void)?
        var onClose: (() -> Void)?

        private let sessionId: String
        private let trace: SharingTrace
        /// The document the lent view is already showing, if the warm-up finished. Decided once
        /// at the tap by `SharingPresentation`; re-asking later would race the answer.
        private let activationBaseURL: String?

        // Individually injected, not `() -> FrakClient`. Defaulted lazily since `Frak.initialize`
        // may not have run when this is constructed.
        private let buildSharingLink: @Sendable (SharingRequest) async -> String?
        private let anonymousId: @Sendable () async -> String?
        private let environment: @Sendable () -> FrakEnvironment
        private let resolveConfig: @Sendable () async throws -> FrakResolvedConfig
        private let bestReward: @Sendable (String?, [ProductDetails]) async -> BestReward?
        private let track: @Sendable (Interaction) async -> Result<Void, FrakError>
        private let installPageURL: @Sendable (String, String) async -> String?
        private let openFrakApp: @Sendable () async -> OpenAppResult

        private var webView: SharingWebView?
        private var session: SharingSession?
        private var deadline: Task<Void, Never>?
        private var started = false
        private var closed = false
        /// Guards `loadSessionURL` so the session's page is navigated to exactly once.
        private var sessionLoaded = false
        /// The deadline and the page's own load failure are independent triggers; without this,
        /// one share could queue two `sharing` interactions.
        private var fellBack = false
        private var deadlineExpired = false
        /// A share is between its page-side press and its outcome; see `share()`.
        private var shareInFlight = false
        /// The `copy()` half of `shareInFlight`: two taps would bill two interactions for one copy.
        private var copyInFlight = false
        /// On the wallet's install page rather than the sharing page, so `onPageUnavailable` can
        /// tell a failed install page apart from a failed sharing page.
        private var showingInstallPage = false

        init(
            sessionId: String,
            trace: SharingTrace = SharingTrace(),
            activationBaseURL: String? = nil,
            buildSharingLink: @escaping @Sendable (SharingRequest) async -> String? = {
                await (try? Frak.client)?.sharing.buildLink($0)
            },
            anonymousId: @escaping @Sendable () async -> String? = { await (try? Frak.client)?.anonymousId },
            // Only read from `build(_:)`, reached after `prepare` has confirmed `Frak.isInitialized`.
            environment: @escaping @Sendable () -> FrakEnvironment = { (try? Frak.client)?.environment ?? .production },
            resolveConfig: @escaping @Sendable () async throws -> FrakResolvedConfig = {
                try await Frak.client.config.resolve()
            },
            bestReward: @escaping @Sendable (String?, [ProductDetails]) async -> BestReward? = {
                targetInteraction,
                products in
                try? await (try? Frak.client)?.rewards.best(targetInteraction: targetInteraction, products: products)
            },
            track: @escaping @Sendable (Interaction) async -> Result<Void, FrakError> = {
                await (try? Frak.client)?.tracking.track($0) ?? .failure(.notInitialized)
            },
            installPageURL: @escaping @Sendable (String, String) async -> String? = { returnScheme, sessionId in
                await (try? Frak.client)?.appLink.installPageURL(returnScheme: returnScheme, sessionId: sessionId)
            },
            openFrakApp: @escaping @Sendable () async -> OpenAppResult = {
                await (try? Frak.client)?.appLink.openFrakApp() ?? .failed
            }
        ) {
            self.sessionId = sessionId
            self.trace = trace
            self.activationBaseURL = activationBaseURL
            self.pageVisible = activationBaseURL != nil
            self.buildSharingLink = buildSharingLink
            self.anonymousId = anonymousId
            self.environment = environment
            self.resolveConfig = resolveConfig
            self.bestReward = bestReward
            self.track = track
            self.installPageURL = installPageURL
            self.openFrakApp = openFrakApp
        }

        func attach(_ webView: SharingWebView) {
            guard self.webView !== webView else { return }
            self.webView = webView
            loadSessionURL()
        }

        /// Idempotent: the presentation starts this at the tap and the sheet re-asks on
        /// `onAppear`. A second preparation would double every event this one queues.
        func start(_ request: SharingRequest) async {
            guard !started else { return }
            started = true
            deadline = Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(Self.pageLoadDeadline * 1_000_000_000))
                guard !Task.isCancelled else { return }
                self?.onDeadline()
            }
            await prepare(request)
        }

        /// Drops this model's reference to the view and stops the budget. Does not destroy the
        /// view (lent by `SharingWebViewPool`) or set `closed`: an in-flight share or tier-3
        /// fallback outlives the sheet and must still report its outcome.
        func release() {
            deadline?.cancel()
            deadline = nil
            webView = nil
        }

        func share() async {
            guard let session else { return }
            // The page's footer stays enabled for the whole round trip, so two taps would bill
            // two interactions for one share.
            guard !shareInFlight else { return }
            shareInFlight = true
            // After the chooser, only on success: this interaction pays out, so recording it on
            // intent would reward a cancelled chooser.
            guard await NativeShare.share(link: session.link, title: session.shareTitle) else {
                // Cleared, unlike the success path: the page is still on its sharing screen.
                shareInFlight = false
                return
            }
            await trackSharing()
            confirm(.shared(link: session.link))
            // Not cleared: the confirmation screen has no Share button; `.shareAgain` clears it.
        }

        /// The user tapped Copy link. Reports rather than `confirm`s: the page already moves to
        /// its confirmation screen, and navigating on top would tear down the document mid-toast.
        func copy() async {
            guard let session else { return }
            guard !copyInFlight else { return }
            copyInFlight = true
            // Before the copy, unlike `share()`: there is no chooser to cancel.
            await trackSharing()
            NativeShare.copy(session.link)
            report(.copied(link: session.link))
        }

        func onPageReady() {
            pageLoaded = true
            settleContent()
        }

        func onPageVisible() {
            pageVisible = true
        }

        /// The web view gave up, tier-2 retry included.
        func onPageUnavailable() {
            // A failed install page lands here first; the user has already shared, so reload the
            // confirmation screen rather than firing tier 3.
            if showingInstallPage {
                // Computed *before* clearing the flag: clearing first would hang a fragment off
                // the failed install page's own URL, leaving the user nowhere.
                let recovery = pageNavigation(confirmed: true)
                showingInstallPage = false
                recovery.map { webView?.navigate($0) }
                return
            }
            // `pageLoaded` matters: a content-process crash after the page painted arrives here
            // too, and a chooser then would be a share the user never asked for.
            guard
                case .nativeShare(let session) = sharingDecision(
                    session: session,
                    deadlineExpired: true,
                    pageLoaded: pageLoaded,
                    fellBack: fellBack,
                    closed: closed
                )
            else { return }
            Task { await fallBack(to: session) }
        }

        func onPageAction(_ action: SharingPageAction) {
            switch action {
            case .install:
                Task {
                    guard let session else { return }
                    // The install page rather than the store: it is the only iOS route that
                    // keeps attribution.
                    guard
                        let page = await installPageURL(session.returnScheme, sessionId),
                        let url = URL(string: page)
                    else {
                        // Nothing to build an install page from; the store handoff closes the sheet.
                        _ = await openFrakApp()
                        report(.installStarted)
                        close()
                        return
                    }
                    // A full load, never an activation: this is a different document.
                    webView?.load(url)
                    showingInstallPage = true
                    report(.installStarted)
                }
            case .shareAgain:
                if let navigation = pageNavigation(confirmed: false) {
                    shareInFlight = false
                    copyInFlight = false
                    // Back on the sharing page — a later load failure belongs to it again.
                    showingInstallPage = false
                    webView?.navigate(navigation)
                }
            // The page draws both buttons; this model performs them — the SDK keypair the page
            // cannot reach has to sign the interaction.
            case .share:
                Task { await share() }
            case .copy:
                Task { await copy() }
            case .code(let value, let expiresAt):
                // The SDK owns the pasteboard: `localOnly` and an expiry are options the page can't set.
                NativeShare.copyInstallCode(value, expiresAt: expiresAt)
            case .dismiss:
                close()
            case .error:
                fail(.decoding(message: "the sharing page refused to render"))
            case .ready:
                trace.mark("page reported ready")
                // Settles the tier-3 deadline too: a fragment activation is a same-document
                // navigation, for which WebKit fires no `didFinish`.
                onPageReady()
                onPageVisible()
            }
        }

        func openExternally(_ url: URL) {
            // Anything but http(s) is an app-to-app launch the merchant never sanctioned.
            guard url.scheme == "https" || url.scheme == "http" else { return }
            // `SKOverlay` installs in place and needs no `LSApplicationQueriesSchemes` entry.
            if isWalletAppStoreListing(url) {
                if presentAppStoreOverlay() { return }
                // No foreground-active scene for the overlay. `UIApplication.open` would send an
                // already-installed wallet's owner to its own store page; `openFrakApp` does not.
                Task { _ = await openFrakApp() }
                return
            }
            Task { _ = await UIApplication.shared.open(url) }
        }

        /// The wallet's own listing and nothing else on `apps.apple.com`. Scans path components,
        /// so storefront-prefixed forms like `/us/app/name/id123` still match.
        private func isWalletAppStoreListing(_ url: URL) -> Bool {
            guard url.host?.caseInsensitiveCompare(Self.appStoreHost) == .orderedSame else {
                return false
            }
            return url.pathComponents.contains("id" + Self.walletAppStoreId)
        }

        /// - Returns: whether the overlay was presented; false leaves the caller to open the URL.
        private func presentAppStoreOverlay() -> Bool {
            // `SKOverlay` is unavailable on Mac Catalyst, which `canImport(UIKit)` doesn't exclude.
            #if targetEnvironment(macCatalyst)
                return false
            #else
                guard
                    let scene = UIApplication.shared.connectedScenes
                        .compactMap({ $0 as? UIWindowScene })
                        .first(where: { $0.activationState == .foregroundActive })
                else { return false }
                let configuration = SKOverlay.AppConfiguration(
                    appIdentifier: Self.walletAppStoreId,
                    position: .bottom
                )
                SKOverlay(configuration: configuration).present(in: scene)
                return true
            #endif
        }

        private func prepare(_ request: SharingRequest) async {
            guard Frak.isInitialized else {
                fail(.notInitialized)
                return
            }

            let built: SharingSession
            do {
                built = try await build(request)
            } catch let error as FrakError {
                fail(error)
                return
            } catch {
                fail(.decoding(message: "unexpected failure: \(error.localizedDescription)"))
                return
            }

            session = built
            // `closed` matters here too: the sheet can finish while `build` is still suspended.
            switch sharingDecision(
                session: built,
                deadlineExpired: deadlineExpired,
                pageLoaded: pageLoaded,
                fellBack: fellBack,
                closed: closed,
                currentBaseURL: activationBaseURL
            ) {
            case .showPage:
                // The decision above answers *whether* to navigate; `loadSessionURL` owns *when*,
                // since the view may not be attached yet.
                loadSessionURL()
            case .nativeShare(let session):
                await fallBack(to: session)
            case .doNothing:
                return
            }
        }

        /// Navigates to the session's page once both halves exist, and at most once.
        private func loadSessionURL() {
            guard !sessionLoaded, let webView, let navigation = pageNavigation(confirmed: false) else { return }
            sessionLoaded = true
            webView.navigate(navigation)
        }

        /// How the page gets where it is going next, preferring a same-document activation over
        /// loading it again. Every navigation this sheet makes goes through here, not just the first.
        private func pageNavigation(confirmed: Bool) -> SharingNavigation? {
            session?.navigation(
                confirmed: confirmed,
                // Not the view's own tracked value: only this model knows where it navigated the view.
                currentBaseURL: showingInstallPage ? nil : activationBaseURL
            )
        }

        /// Builds the session off the main actor, so it is not queued behind the sheet's own
        /// presentation work. Returns a no-page session, never nil, when `resolveConfig` fails —
        /// the link is local and still shareable; throws only when there is nothing to share.
        private nonisolated func build(_ request: SharingRequest) async throws -> SharingSession {
            guard let link = await buildSharingLink(request) else {
                // The one failure the fallback cannot help with: there is no link to share.
                throw FrakError.merchantResolutionFailed(
                    reason: "no anonymous id or merchant to build a sharing link from"
                )
            }
            trace.mark("  link built")
            guard let clientId = await anonymousId() else {
                throw FrakError.merchantResolutionFailed(
                    reason: "no anonymous id or merchant to build a sharing link from"
                )
            }
            trace.mark("  identity ready")

            let walletOrigin = environment().wallet
            let bundleId = Bundle.main.bundleIdentifier ?? ""
            let returnScheme = SharingPageURL.returnScheme(bundleId: bundleId)

            let config: FrakResolvedConfig
            do {
                config = try await resolveConfig()
            } catch is FrakError {
                // No page, but the link is already built; the native-share fallback fires from this.
                return SharingSession(
                    walletOrigin: walletOrigin,
                    returnScheme: returnScheme,
                    link: link,
                    shareTitle: nil,
                    pageURL: nil
                )
            }
            trace.mark("  config resolved")

            let name = config.displayName
            let requestLogoURL = request.logoURL
            let productsJSON = sharingPageProductsJSON(request.products)
            let pageLink = request.link ?? request.products.first?.link
            let seeded = await seededReward(request)
            trace.mark("  reward seeded")

            return SharingSession(
                walletOrigin: walletOrigin,
                returnScheme: returnScheme,
                link: link,
                shareTitle: name,
                pageURL: SharingPageURL.build(
                    walletOrigin: walletOrigin,
                    merchantId: config.merchantId,
                    clientId: clientId,
                    bundleId: bundleId,
                    sessionId: sessionId,
                    appName: name,
                    logoURL: requestLogoURL ?? config.displayLogoURL,
                    link: pageLink,
                    products: productsJSON,
                    seededReward: seeded
                ),
                // Rebuilt from the same resolved config as `pageURL`: if the pool warmed against
                // anything else the strings differ and the session does a full load instead.
                warmBaseURL: SharingPageURL.warm(
                    walletOrigin: walletOrigin,
                    merchantId: config.merchantId,
                    clientId: clientId,
                    bundleId: bundleId,
                    appName: name,
                    logoURL: config.displayLogoURL
                ),
                activationFragment: SharingPageURL.activationFragment(
                    sessionId: sessionId,
                    link: pageLink,
                    products: productsJSON,
                    // Only when the request overrides the config; the warm URL already carries it.
                    logoURL: requestLogoURL,
                    seededReward: seeded
                )
            )
        }

        /// A cached headline for the first frame, or nothing. Bounded — the page matters more.
        private nonisolated func seededReward(_ request: SharingRequest) async -> String? {
            let timeout = Self.seedTimeout
            let targetInteraction = request.targetInteraction
            // Scoped like the page's own selection, so the seed cannot show a different reward.
            let products = request.products.compactMap(\.details)
            return await withTaskGroup(of: String?.self) { group in
                group.addTask {
                    await self.bestReward(targetInteraction, products)?.formatted
                }
                group.addTask {
                    try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                    return nil
                }
                let first = await group.next() ?? nil
                group.cancelAll()
                return first
            }
        }

        private func onDeadline() {
            switch sharingDecision(
                session: session,
                deadlineExpired: true,
                pageLoaded: pageLoaded,
                fellBack: fellBack,
                closed: closed
            ) {
            case .nativeShare(let session):
                Task { await fallBack(to: session) }
            case .doNothing:
                // Includes "no session built yet": `prepare` falls back itself when it returns.
                deadlineExpired = true
            case .showPage:
                // Unreachable: `deadlineExpired: true` above never yields a page.
                return
            }
        }

        /// Tier 3: skip the page entirely and open the OS share sheet on the local link.
        private func fallBack(to session: SharingSession) async {
            guard !fellBack else { return }
            fellBack = true
            settleContent()

            // Same rule as `share()`: the interaction follows the chooser rather than announcing it.
            let shared = await NativeShare.share(link: session.link, title: session.shareTitle)
            if shared { await trackSharing() }
            report(shared ? .shared(link: session.link) : .dismissed)
            close()
        }

        private func trackSharing() async {
            _ = await track(.sharing())
        }

        /// Records an outcome the sheet stays open after and moves the page onto its post-share
        /// state. Only this model learns whether a chooser actually came up.
        private func confirm(_ result: SharingResult) {
            report(result)
            guard let navigation = pageNavigation(confirmed: true) else { return }  // nil under tier 3 (no page)
            webView?.navigate(navigation)
        }

        private func report(_ result: SharingResult) {
            onOutcome?(result)
        }

        private func fail(_ error: FrakError) {
            report(.failed(error))
            close()
        }

        private func close() {
            guard !closed else { return }
            closed = true
            settleContent()
            onClose?()
        }

        private func settleContent() {
            deadline?.cancel()
            deadline = nil
        }

        // `sharingPageProductsJSON` lives in SharingSheetLogic.swift, outside this `#if`.
    }
#endif
