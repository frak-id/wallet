#if canImport(UIKit)
    import Foundation
    import FrakSDK
    import StoreKit
    import SwiftUI
    import UIKit

    // `SharingSession`, `SharingNavigation` and `sharingDecision` live in SharingSheetLogic.swift,
    // outside this file's `#if canImport(UIKit)`, so they stay reachable from a macOS test host.

    /// The sheet's behaviour, kept out of the view. Ordering matters here — attribute the
    /// share after the OS share sheet, reload with `&confirmed=1` after it, never fall back
    /// twice — and sequencing inside a re-evaluating `body` is where that kind of flow breaks.
    ///
    /// Constructed by `SharingPresentation.start` at the tap, not by the sheet: the session is
    /// already under way by the time the sheet is asked to render it. See `SharingPresentation`.
    @MainActor
    final class SharingSheetModel: ObservableObject {
        /// Tap-to-content budget, timed from the tap rather than from the page starting to
        /// load: it has to cover `buildSharingLink` and `resolveConfig` too.
        static let pageLoadDeadline: TimeInterval = 1.5
        /// How long the reward headline may delay the page navigation.
        ///
        /// Sized for a cache hit and nothing more. `RewardRepository` keys its cache on the
        /// encoded product list, so the first share of any given product is always a miss, and a
        /// budget large enough to cover one bought a cosmetic headline by delaying the
        /// navigation behind it on every one of those. At this timeout a hit still lands (a
        /// cache read is a lock and a dictionary lookup) and a miss costs nothing — the page
        /// fetches the same value itself either way.
        /// `nonisolated` because `build` reads it off the main actor — see `build(_:)`.
        nonisolated static let seedTimeout: TimeInterval = 0.04
        /// Host of the store link the install page renders, so it can be answered with an
        /// in-app overlay instead of a trip to the App Store app.
        private static let appStoreHost = "apps.apple.com"
        /// The wallet's App Store id. Matches the listing in `InstallLinks`; `SKOverlay` wants
        /// the bare numeric id, not a URL.
        private static let walletAppStoreId = "6740261164"

        /// Whether the hosted page has actually painted. Drives the skeleton that covers the web
        /// view until then.
        ///
        /// Latches: once the page has been seen, a later same-session navigation (the
        /// `confirmed=1` step, the install page) must not put the skeleton back — the user is
        /// looking at real content and a reappearing placeholder reads as a fault.
        ///
        /// Starts true when this sheet was handed a finished warm page. The skeleton exists to
        /// hide a blank web view, and an activated view is not blank — it is already showing the
        /// merchant's own page, painted before the user tapped.
        @Published private(set) var pageVisible: Bool

        /// Document-finished. Observable so the sheet can bound how long its skeleton waits for
        /// a paint signal.
        @Published private(set) var pageLoaded = false

        /// Every outcome as it happens; the caller keeps the most significant.
        var onOutcome: ((SharingResult) -> Void)?
        /// Asks the presenter to take the sheet down.
        var onClose: (() -> Void)?

        private let sessionId: String
        /// Milestones inside `build`, which device traces on Android showed to be the largest
        /// share of tap-to-paint.
        private let trace: SharingTrace
        /// The document the view handed to this sheet is already showing, if it is a finished
        /// warm page. Lets the session activate by fragment instead of loading the page a second
        /// time.
        ///
        /// Decided once, at the tap, by `SharingPresentation`: whether the warm-up had finished
        /// by then is exactly the question, and re-asking it later would race the answer.
        private let activationBaseURL: String?

        // Individually injected, not `() -> FrakClient`: the seam is the handful of members this
        // sheet actually calls. Defaulted to `Frak.client`'s namespaces, resolved lazily since
        // Frak.initialize may not have run when this is constructed.
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
        /// The 1.5s budget and the page's own load failure are independent triggers on the same
        /// session; without this, one share could queue two `sharing` interactions.
        private var fellBack = false
        private var deadlineExpired = false
        /// A share is between its page-side press and its outcome. See `share()` for why the
        /// page's own button cannot be trusted to have gone away in the meantime.
        private var shareInFlight = false
        /// The `copy()` half of `shareInFlight`: two taps would bill two interactions for one copy.
        private var copyInFlight = false
        /// The sheet has left the sharing page for the wallet's install page. Not `@Published`:
        /// nothing renders off it. Survives only so `onPageUnavailable` can tell a failed install
        /// page apart from a failed sharing page, which reach it identically and need opposite
        /// answers.
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

        /// Gives this model the view it will drive. Called before the sheet renders, so the page
        /// can start loading while the sheet is still animating in.
        func attach(_ webView: SharingWebView) {
            guard self.webView !== webView else { return }
            self.webView = webView
            loadSessionURL()
        }

        /// Idempotent: the presentation starts this at the tap, and the sheet re-asks on
        /// `onAppear` in case the tap-time start never happened. A second preparation would
        /// double every event this one queues.
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

        /// Drops this model's reference to the view and stops the budget.
        ///
        /// Deliberately does NOT destroy the view: it was lent by `SharingWebViewPool` and is
        /// handed back there, since a pooled view is lent for one sheet and reused by the next.
        /// Deliberately does not set `closed` either — an in-flight `share` or tier-3 fallback
        /// outlives the sheet that started it, and suppressing outcomes here would report
        /// `.dismissed` for a share that succeeded.
        func release() {
            deadline?.cancel()
            deadline = nil
            webView = nil
        }

        /// The user tapped Share, in the page's own footer.
        func share() async {
            guard let session else { return }
            // The page's footer stays enabled for the whole round trip — the web's `isSharing`
            // guard belongs to `useShareLink`, which a handed-off press never reaches. Without
            // `shareInFlight`, two taps across `trackSharing()` below would bill two interactions
            // for one share, the same failure `fellBack` exists to stop for tier 3.
            guard !shareInFlight else { return }
            shareInFlight = true
            // Tracked after the chooser, only on success: this is the reward-bearing interaction,
            // not an analytics event. Recording it on intent would pay out for a chooser opened
            // and cancelled. A share completed while the host is jettisoned is lost — the accepted
            // cost of not counting cancellations.
            guard await NativeShare.share(link: session.link, title: session.shareTitle) else {
                // Cleared, unlike the success path: the user dismissed without sharing, so the
                // page is still on its sharing screen and must be able to try again.
                shareInFlight = false
                return
            }
            await trackSharing()
            confirm(.shared(link: session.link))
            // Not cleared: `confirm` moves onto the confirmation screen, which has no Share
            // button. `.shareAgain` reopens the flow and clears it.
        }

        /// The user tapped Copy link, in the page's own footer. Reports the outcome rather than
        /// `confirm`ing it: the page already moves to its confirmation screen and raises its own
        /// toast on press, and a `confirmed=1` navigation on top would tear down the document
        /// mid-toast. `share()` still confirms because only this model learns whether a chooser
        /// came up.
        func copy() async {
            guard let session else { return }
            guard !copyInFlight else { return }
            copyInFlight = true
            // Before, unlike `share()`: a copy has no chooser and no completion to wait on, so
            // there is no cancellation to avoid counting. Matches the web's `handleCopy`.
            await trackSharing()
            NativeShare.copy(session.link)
            report(.copied(link: session.link))
        }

        func onPageReady() {
            pageLoaded = true
            settleContent()
        }

        /// The page has painted, so the skeleton covering it can lift.
        func onPageVisible() {
            pageVisible = true
        }

        /// The web view gave up, tier-2 retry included.
        func onPageUnavailable() {
            // A failed install page lands here first. Tier 3 is not the answer — the user has
            // already shared — so this reloads the confirmation screen instead, which has its own
            // share-again and install controls.
            if showingInstallPage {
                // Computed *before* clearing the flag. `pageNavigation` reads it to decide
                // whether the view is still on the activated document, and the view is
                // emphatically not: it is on an install page that just failed. Clearing first
                // would recover by hanging a fragment off the failed page's own URL, leaving the
                // user nowhere.
                let recovery = pageNavigation(confirmed: true)
                showingInstallPage = false
                recovery.map { webView?.navigate($0) }
                return
            }
            // Same predicate as the deadline: `pageLoaded` matters because a content-process
            // crash after the page painted arrives here too, and a chooser now would be a share
            // the user never asked for. `deadlineExpired: true` because there's no page left to
            // spend the budget on.
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
                    // The sheet stays open and navigates to the wallet's install page rather than
                    // handing the user to the store: that page owns install code / store link /
                    // installed-wallet routing, and it's the only route by which an iOS install
                    // keeps attribution — there's no App Store equivalent of the Play referrer.
                    guard
                        let page = await installPageURL(session.returnScheme, sessionId),
                        let url = URL(string: page)
                    else {
                        // No identity or no merchant to hand the install page; the store handoff
                        // is the fallback, and it closes the sheet.
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
                    // Sharing again: reopen the guards `share()`/`copy()` left closed.
                    shareInFlight = false
                    copyInFlight = false
                    // Back on the sharing page — a later load failure belongs to it again.
                    showingInstallPage = false
                    webView?.navigate(navigation)
                }
            // The page draws both buttons; this model performs them, since the interaction has
            // to be signed by the SDK keypair the page cannot reach.
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
                // Progress, not an outcome: the page says it has painted. Everything else in this
                // switch finishes the session.
                trace.mark("page reported ready")
                // Settles the tier-3 deadline as well as the skeleton, and that is not
                // belt-and-braces. A fragment activation is a same-document navigation, for which
                // WebKit fires no `didFinish` — the only other thing that settles it. Without
                // this, the fastest path would be the one that times out at 1.5s and fell back to
                // the OS chooser with a perfectly good page already on screen.
                onPageReady()
                onPageVisible()
            }
        }

        func openExternally(_ url: URL) {
            // Anything but http(s) is an app-to-app launch the merchant never sanctioned.
            guard url.scheme == "https" || url.scheme == "http" else { return }
            // The install page's download button is the one link worth keeping in-app:
            // `SKOverlay` installs in place and needs no `LSApplicationQueriesSchemes` entry.
            if isWalletAppStoreListing(url) {
                if presentAppStoreOverlay() { return }
                // No foreground-active scene to host the overlay. Falling through to
                // `UIApplication.shared.open(url)` would send an already-installed wallet's
                // owner to its own store page. `openFrakApp()` tries the wallet's scheme first
                // and only reaches the store if that fails.
                Task { _ = await openFrakApp() }
                return
            }
            Task { _ = await UIApplication.shared.open(url) }
        }

        /// The wallet's own App Store listing, and nothing else on `apps.apple.com`. Matched on
        /// the id path component, not the host, so a link to some other app can't match; scanning
        /// components, not comparing paths, handles storefront-prefixed forms like `/us/app/name/id123`.
        private func isWalletAppStoreListing(_ url: URL) -> Bool {
            guard url.host?.caseInsensitiveCompare(Self.appStoreHost) == .orderedSame else {
                return false
            }
            return url.pathComponents.contains("id" + Self.walletAppStoreId)
        }

        /// - Returns: whether the overlay was presented; false leaves the caller to open the
        ///   URL normally, so a missing scene can never swallow the download.
        private func presentAppStoreOverlay() -> Bool {
            // `SKOverlay` is unavailable on Mac Catalyst, which `canImport(UIKit)` doesn't
            // exclude; falling through opens the listing in the browser instead.
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
            // `closed` matters here too: the sheet can reach a terminal outcome while `build`
            // is still suspended, and navigating after that would be work nobody sees.
            switch sharingDecision(
                session: built,
                deadlineExpired: deadlineExpired,
                pageLoaded: pageLoaded,
                fellBack: fellBack,
                closed: closed,
                currentBaseURL: activationBaseURL
            ) {
            case .showPage:
                // Straight into the view rather than waiting for the sheet to notice. The
                // decision above only answers *whether* to navigate; `loadSessionURL` owns
                // *when*, since the view may not be attached yet.
                loadSessionURL()
            case .nativeShare(let session):
                await fallBack(to: session)
            case .doNothing:
                return
            }
        }

        /// Navigates to the session's page, once both halves exist. Fires from whichever of
        /// `attach`/`prepare` completes second, and at most once — a second navigation would
        /// restart a load already in flight.
        private func loadSessionURL() {
            guard !sessionLoaded, let webView, let navigation = pageNavigation(confirmed: false) else { return }
            sessionLoaded = true
            webView.navigate(navigation)
        }

        /// How the page should get where it is going next, preferring a same-document activation
        /// over loading the whole page again.
        ///
        /// Every navigation this sheet makes goes through here, not just the first: once the view
        /// is on the warm document, the confirmation and share-again steps are fragment changes
        /// too, and routing only the initial load through it would make those the expensive ones
        /// instead.
        private func pageNavigation(confirmed: Bool) -> SharingNavigation? {
            session?.navigation(
                confirmed: confirmed,
                // Not the view's own tracked value: once the sheet owns the view it navigates
                // the view itself (install page, and back), and only this model knows where it
                // went.
                currentBaseURL: showingInstallPage ? nil : activationBaseURL
            )
        }

        /// Builds the session off the main actor.
        ///
        /// `nonisolated` deliberately, and the reason is Android's: every dependency here is an
        /// immutable `@Sendable` closure, and a build queued behind the sheet's own presentation
        /// work is a build that has not started. Android measured 203-430ms of exactly that
        /// against Compose's frame-clock dispatcher; iOS's main-actor executor is drained by the
        /// run loop rather than by a frame callback, so the iOS number is unmeasured and probably
        /// smaller — but there is no reason to put network and keystore work on the main actor to
        /// find out.
        ///
        /// Returns a no-page session, never nil, when `resolveConfig` fails: the link is local
        /// and still shareable. Throws only when there is nothing to share at all.
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
                // No page, but the link is already built. Not a failure — this is the input
                // the native-share fallback fires from, immediately.
                return SharingSession(
                    walletOrigin: walletOrigin,
                    returnScheme: returnScheme,
                    link: link,
                    shareTitle: nil,
                    pageURL: nil
                )
            }
            trace.mark("  config resolved")

            let name = config.sdkConfig?.name ?? config.name
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
                    logoURL: requestLogoURL ?? config.sdkConfig?.logoURL,
                    link: pageLink,
                    products: productsJSON,
                    seededReward: seeded
                ),
                // Rebuilt here rather than passed in from the pool, so it is derived from the
                // same resolved config as `pageURL`. If the pool warmed against anything else — a
                // stale merchant, a config that changed under us — the strings differ and the
                // session falls back to a full load rather than activating on top of the wrong
                // page.
                warmBaseURL: SharingPageURL.warm(
                    walletOrigin: walletOrigin,
                    merchantId: config.merchantId,
                    clientId: clientId,
                    bundleId: bundleId,
                    appName: name,
                    logoURL: config.sdkConfig?.logoURL
                ),
                activationFragment: SharingPageURL.activationFragment(
                    sessionId: sessionId,
                    link: pageLink,
                    products: productsJSON,
                    // Only when the request overrides the config: the warm URL already carries
                    // the config's own logo, and re-sending it would be noise.
                    logoURL: requestLogoURL,
                    seededReward: seeded
                )
            )
        }

        /// A cached headline for the first frame, or nothing. Bounded, because the page is
        /// worth more than the headline on it.
        private nonisolated func seededReward(_ request: SharingRequest) async -> String? {
            let timeout = Self.seedTimeout
            let targetInteraction = request.targetInteraction
            // Scoped the same way the page's own selection will be, so the seed the user sees
            // for the first frame cannot show a different reward than the one the page settles on.
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
                // Includes "`prepare` has not built a session yet": it falls back itself when it
                // returns and reads `deadlineExpired`, rather than racing this.
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

            // Same rule as `share()`: the interaction pays out, so it follows the chooser
            // rather than announcing it.
            let shared = await NativeShare.share(link: session.link, title: session.shareTitle)
            if shared { await trackSharing() }
            report(shared ? .shared(link: session.link) : .dismissed)
            close()
        }

        private func trackSharing() async {
            _ = await track(.sharing())
        }

        /// Records an outcome the sheet stays open after, and moves the page onto its
        /// post-share state.
        ///
        /// A `confirmed=1` navigation rather than letting the page confirm itself: only this
        /// model learns whether a chooser actually came up, and the confirmation has to survive
        /// the user leaving and coming back. On the warm path this is a fragment change, so it
        /// costs nothing; the page syncs its confirmation state by effect precisely because a
        /// fragment does not remount it.
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

        // `sharingPageProductsJSON` lives in SharingSheetLogic.swift, outside this file's
        // `#if canImport(UIKit)`, so the macOS test host can pin what reaches the page.
    }
#endif
