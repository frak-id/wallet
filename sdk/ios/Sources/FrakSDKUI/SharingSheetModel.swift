#if canImport(UIKit)
    @_spi(FrakInternal) import FrakSDK
    import Foundation
    import StoreKit
    import SwiftUI
    import UIKit

    // `SharingSession`, `SharingNavigation` and `sharingDecision` live in
    // SharingSheetLogic.swift, outside this `#if`, so they stay reachable from a macOS test host.

    /// The sheet's behaviour, kept out of the view. Ordering matters — attribute the share
    /// after the OS chooser, confirm after that, never fall back twice.
    @MainActor
    final class SharingSheetModel: ObservableObject {
        /// Tap-to-content budget, timed from the tap, so it has to cover the build too. Sized for a
        /// full load, not a warm activation: warming is usually still in flight at the tap, so the
        /// common case is the slow one. `SharingWebView`'s retry ladder fits inside this.
        static let pageLoadDeadline: TimeInterval = 5
        // `sharingBuildRetryDelays` and `sharingBuildIsWorthRetrying` live in SharingSheetLogic
        // .swift, outside this `#if`, so the ladder has a host-run test.
        nonisolated static let seedTimeout: TimeInterval = 0.04
        // The App Store handoff lives behind `StoreInvite`.

        /// How far the hosted page has got. One value rather than three published booleans, which
        /// could spell "painted but lost" and "lost before it ever rendered".
        enum PagePhase {
            /// Nothing on screen yet; the skeleton covers the web view.
            case loading
            /// The document finished, but nothing says it has drawn. A warm page starts here even
            /// though its document is complete: a pooled `WKWebView` is in no view hierarchy until
            /// a sheet presents it, so uncovering it would show an empty sheet until it paints.
            case documentReady
            /// The page's own `action=ready`, or any user action on it — either is proof it drew.
            case painted
            /// A renderer crash after the page had painted. `SharingWebView` is `isOpaque = false`
            /// and the sheet clears its background, so what is left is a see-through hole to cover.
            case lost
        }

        @Published private(set) var page: PagePhase = .loading

        /// Whether the page has drawn; drives the skeleton over the web view.
        var pageVisible: Bool { page == .painted }

        /// Document-finished, so the sheet can bound its skeleton's wait.
        var pageLoaded: Bool { page != .loading }

        var contentLost: Bool { page == .lost }

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
        /// Throwing, deliberately: a `try?` here collapsed `.trackingDisabled`, a refused enclave
        /// key and a cold merchant resolve into one nil, which the retry ladder then could not
        /// tell apart and the merchant's `onResult` reported as the wrong thing.
        private let buildSharingLink: @Sendable (SharingRequest) async throws -> String?
        private let anonymousId: @Sendable () async -> String?
        private let environment: @Sendable () -> FrakEnvironment
        private let resolveConfig: @Sendable () async throws -> FrakResolvedConfig
        private let bestReward: @Sendable (String?, [ProductDetails]) async -> BestReward?
        private let track: @Sendable (Interaction) async -> Result<Void, FrakError>
        private let installPageURL: @Sendable (String, String) async -> String?
        private let isFrakAppInstalled: @Sendable () async -> Bool
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
        /// The page's buttons that are mid-round-trip. The footer stays enabled throughout, so
        /// without this a second tap stacks a second chooser, bills a second reward-bearing
        /// interaction, or races two install pages on the one shared web view. A set, matching
        /// Android's `SharingSheetState.claimed`, so `shareAgain` reopens them all at once.
        private var claimed: Set<SharingPageAction> = []
        /// On the wallet's install page rather than the sharing page, so `onPageUnavailable` can
        /// tell a failed install page apart from a failed sharing page.
        private var showingInstallPage = false
        private let storeInvite: any StoreInvite
        private let installProbe: InstallProbe?
        private let language: String?
        /// Set at the tap so `didDetectInstall` can rebuild the fragment `onPageUnavailable`
        /// would otherwise have no context for.
        private var installProofURL: URL?
        private var installProbeStatus: ProbeStatus = .disabled

        init(
            sessionId: String,
            trace: SharingTrace = SharingTrace(),
            activationBaseURL: String? = nil,
            install: FrakInstallPresentation = FrakSharingDefaults.install,
            // No default: a defaulted merchant opt-out is one that silently stops being threaded.
            detectInstall: Bool,
            /// BCP-47, and it must be what the pool warmed on: `warmBaseURL` is compared
            /// string-for-string, so a mismatch costs the warm view and does a full load.
            language: String? = nil,
            buildSharingLink: @escaping @Sendable (SharingRequest) async throws -> String? = {
                try await Frak.client.sharing.buildLink($0)
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
                try? await Frak.client.appLink.installPageURL(returnScheme: returnScheme, sessionId: sessionId)
            },
            // Answers false when the merchant never declared the wallet's scheme in
            // `LSApplicationQueriesSchemes`, so it may only ever pick the *better* of two working
            // routes — never gate the install handoff itself.
            isFrakAppInstalled: @escaping @Sendable () async -> Bool = {
                await (try? Frak.client)?.appLink.isFrakAppInstalled() ?? false
            },
            openFrakApp: @escaping @Sendable () async -> OpenAppResult = {
                await (try? Frak.client)?.appLink.openFrakApp() ?? .failed
            }
        ) {
            self.sessionId = sessionId
            self.trace = trace
            self.activationBaseURL = activationBaseURL
            self.language = language
            self.storeInvite = StoreInvites.make(install)
            self.installProbe = detectInstall ? InstallProbe() : nil
            self.buildSharingLink = buildSharingLink
            self.anonymousId = anonymousId
            self.environment = environment
            self.resolveConfig = resolveConfig
            self.bestReward = bestReward
            self.track = track
            self.installPageURL = installPageURL
            self.isFrakAppInstalled = isFrakAppInstalled
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
            // Before the invite: a detection racing this teardown must not write a fragment to a
            // view this model has just released.
            installProbe?.stop()
            // Neither store surface belongs to the sheet — one is on the scene, one on its own
            // window — so both outlive it unless taken down here. A tapped GET keeps downloading,
            // so this only costs the untapped case.
            storeInvite.dismiss()
        }

        /// Claims one of the page's buttons for its round trip.
        ///
        /// - Returns: false when that button is already in flight.
        private func claim(_ action: SharingPageAction) -> Bool {
            claimed.insert(action).inserted
        }

        func share() async {
            guard let session else { return }
            // The tier-3 fallback races a page action that arrives in the same turn; without this
            // a chooser it already raised is stacked under a second one, and both attribute.
            guard !fellBack, !closed else { return }
            guard claim(.share) else { return }
            // The OS chooser covers the sheet for the whole of this call, so it cannot be
            // dismissed underneath one.
            // After the chooser, only on success: this interaction pays out, so recording it on
            // intent would reward a cancelled chooser.
            guard await NativeShare.share(link: session.link, title: session.shareTitle) else {
                // Released, unlike the success path: the page is still on its sharing screen.
                claimed.remove(.share)
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
            guard !fellBack, !closed else { return }
            guard claim(.copy) else { return }
            // No chooser covers this one, so a swipe can land inside `trackSharing()` and report
            // `.dismissed` over the `.copied` it is about to produce — a local queue append behind
            // the dismissal animation. Before the copy, unlike `share()`: no chooser to cancel.
            await trackSharing()
            NativeShare.copy(session.link)
            report(.copied(link: session.link))
            // Released, unlike share(): the page keeps its Copy button live on the same screen.
            claimed.remove(.copy)
        }

        func onPageReady() {
            // Never backwards: an already-painted page that reports its document finished, or a
            // renderer crash the sheet has already covered, must not be uncovered again.
            if page == .loading { page = .documentReady }
            settleContent()
        }

        func onPageVisible() {
            if page == .loading || page == .documentReady { page = .painted }
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
                installProbe?.stop()
                installProofURL = nil
                // Back on a page that plausibly offers Install again (the confirmation view), so
                // a second tap must be able to fetch a fresh page instead of finding itself
                // permanently locked out by this session's first attempt.
                claimed.remove(.install)
                if let webView, let recovery { navigateNow(webView, recovery) }
                return
            }
            // A content-process crash after the page arrived: raising a tier-3 chooser now would
            // be a share the user never asked for, and the web view (deliberately transparent —
            // see `SharingWebView.isOpaque`) now composites nothing, so `.lost` tells the sheet to
            // cover it instead of falling back.
            if pageLoaded {
                page = .lost
                return
            }
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
            // A user driving the page proves it both arrived and drew, whatever WebKit reported —
            // a fragment activation is same-document, so there is no `didFinish` for a warm page
            // the user is already sharing from. Without this the deadline can elapse behind an
            // accepted chooser and raise a second one. `.error` is the page saying it drew nothing.
            settleContent()
            if action != .error { onPageVisible() }
            switch action {
            case .install:
                guard let session, claim(.install) else { return }
                // Reported at the tap, not on the far side of `installPageURL`. That call is a
                // network round trip a user can swipe straight through, and this is the highest
                // significance a session can reach, so nothing can outrank it later — a user who
                // asked to install has started an install whether or not the page URL resolves.
                report(.installStarted)
                Task {
                    // The wallet is already here, so the install page has nothing left to do: its
                    // code exists only to reconnect an identity across a fresh install, and the
                    // deep link carries that identity — merchant, anonymous id and proof — itself.
                    if await isFrakAppInstalled(), await openFrakApp() == .openedApp {
                        report(.walletOpened)
                        close()
                        return
                    }
                    // The install page rather than the store: it is the only iOS route that
                    // keeps attribution.
                    guard
                        let page = await installPageURL(session.returnScheme, sessionId),
                        let url = await installProbeURL(page, sessionId: sessionId)
                    else {
                        // Nothing to build an install page from; the store handoff closes the sheet.
                        _ = await openFrakApp()
                        close()
                        return
                    }
                    // A full load, never an activation: this is a different document.
                    webView?.load(url)
                    showingInstallPage = true
                }
            case .shareAgain:
                if let navigation = pageNavigation(confirmed: false) {
                    // Reopens every button `share()`/`copy()`/`.install` left claimed.
                    claimed.removeAll()
                    // Back on the sharing page — a later load failure belongs to it again.
                    showingInstallPage = false
                    installProbe?.stop()
                    installProofURL = nil
                    if let webView { navigateNow(webView, navigation) }
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
                fail(.internalFailure(message: "the sharing page refused to render"))
            case .ready:
                trace.mark("page reported ready")
                // Settles the tier-3 deadline too: a fragment activation is a same-document
                // navigation, for which WebKit fires no `didFinish`.
                onPageReady()
                onPageVisible()
            }
        }

        /// Where the page's own outbound links go. The wallet's store listing prefers the app
        /// over the store, so an already-installed wallet is not offered its own store page.
        func openExternally(_ url: URL) {
            switch sharingExternalRoute(url) {
            case .ignore:
                return
            case .openURL(let url):
                Task { _ = await UIApplication.shared.open(url) }
            case .walletStoreListing:
                Task {
                    // Probed, not assumed installed-by-absence: the store surface always shows the
                    // production listing, so on a device carrying a dev build it offers GET for a
                    // wallet that is already there — and unlike the store, the deep link carries
                    // attribution.
                    if await isFrakAppInstalled(), await openFrakApp() == .openedApp {
                        report(.walletOpened)
                        return
                    }
                    // No scene to raise the surface in, or it refused to load. Opening the listing
                    // here would send an already-installed wallet's owner to its own store page,
                    // so hand off instead.
                    let raised = await storeInvite.present()
                    if !raised { _ = await openFrakApp() }
                }
            }
        }

        private func prepare(_ request: SharingRequest) async {
            guard Frak.isInitialized else {
                fail(.notInitialized)
                return
            }

            let built: SharingSession
            do {
                built = try await buildWithRetry(request)
            } catch let error as FrakError {
                fail(error)
                return
            } catch is CancellationError {
                // `dispose()` cancelled this build; the sheet is already gone. Reporting a failure
                // here would spend this presentation's one `onResult` on a user-driven dismissal.
                return
            } catch {
                fail(.internalFailure(message: "unexpected failure: \(error.localizedDescription)"))
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

        /// `build(_:)`, retried on a transient failure while the skeleton holds the sheet.
        ///
        /// Rethrows the *last* failure rather than the first: the ladder is short enough that the
        /// most recent attempt is the better description of why the sheet is closing.
        private func buildWithRetry(_ request: SharingRequest) async throws -> SharingSession {
            var attempt = 0
            while true {
                do {
                    return try await build(request)
                } catch let error as FrakError where attempt < sharingBuildRetryDelays.count {
                    guard sharingBuildIsWorthRetrying(error) else { throw error }
                    try await Task.sleep(nanoseconds: UInt64(sharingBuildRetryDelays[attempt] * 1_000_000_000))
                    // The sheet went away, or the deadline already promoted this session to a
                    // native share, while this was sleeping. Either way the next attempt has
                    // nobody to hand a page to.
                    guard !closed, !fellBack, !deadlineExpired else { throw error }
                    attempt += 1
                }
            }
        }

        /// Navigates to the session's page once both halves exist, and at most once.
        private func loadSessionURL() {
            guard !sessionLoaded, let webView, let navigation = pageNavigation(confirmed: false) else { return }
            sessionLoaded = true
            navigateNow(webView, navigation)
        }

        /// Navigates, and on an activation records the document the engine will not report. A
        /// fragment change is same-document: no `didFinish`, so the page's own `ready` is the only
        /// word for it — and that rides two `requestAnimationFrame`s, which do not run until the
        /// sheet has put the view on screen. That made the fastest path the one that timed out on
        /// the load deadline and raised the chooser over a page that was already there.
        private func navigateNow(_ webView: SharingWebView, _ navigation: SharingNavigation) {
            webView.navigate(navigation)
            // Only a finished document can be activated, so tap-to-content is already met.
            // `onPageVisible` is not called: paint stays the page's word.
            if case .activate = navigation { onPageReady() }
        }

        /// The install page URL, carrying `sid`/`probe` in its fragment. Starts the probe as a
        /// side effect when it can run at all, so a `.ok` status and a running poll never drift
        /// apart.
        private func installProbeURL(_ page: String, sessionId: String) async -> URL? {
            guard let installProbe else {
                return probedInstallURL(page, sessionId: sessionId, probe: .disabled)
            }
            let started = await installProbe.start(sessionId: sessionId) { [weak self] elapsedMillis in
                self?.didDetectInstall(sessionId: sessionId, elapsedMillis: elapsedMillis)
            }
            return probedInstallURL(page, sessionId: sessionId, probe: started ? .ok : .undeclared)
        }

        private func probedInstallURL(_ page: String, sessionId: String, probe: ProbeStatus) -> URL? {
            let probed = SharingPageURL.installPageProbed(page, sid: sessionId, probe: probe)
            guard let url = URL(string: probed) else { return nil }
            installProbeStatus = probe
            installProofURL = url
            return url
        }

        /// Dismisses the store surface Apple's own OPEN button would otherwise race, then rewrites
        /// the install page in place with the payload the deep link would have carried, through
        /// `navigateNow`/`.activate` like every other in-sheet state change — load-bearing here,
        /// since it hangs the fragment off `webView.url` rather than this session's own URL.
        private func didDetectInstall(sessionId: String, elapsedMillis: TimeInterval) {
            guard showingInstallPage, self.sessionId == sessionId, let webView, let installProofURL else { return }
            storeInvite.dismiss()
            let proof = URLComponents(string: "?" + (installProofURL.fragment ?? ""))?
                .queryItems?.first { $0.name == "p" }?.value
            let surface: InstallSurface = storeInvite is StoreOverlayInvite ? .overlay : .product
            let fragment = SharingPageURL.installDetectedFragment(
                proof: proof,
                sid: sessionId,
                probe: installProbeStatus,
                elapsedMillis: Int(elapsedMillis),
                surface: surface
            )
            navigateNow(webView, .activate(fragment: fragment, fullURL: installProofURL))
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
            guard let link = try await buildSharingLink(request) else {
                // Nothing to link to. Still worth a retry: the last fallback in that chain is the
                // *resolved* config's homepage link, which a cold start has not fetched yet.
                throw FrakError.merchantResolutionFailed(
                    reason: "nothing to link to: neither the request, its products, the resolved "
                        + "config nor FrakMetadata.homepageLink supplies a URL"
                )
            }
            trace.mark("  link built")
            guard let clientId = await anonymousId() else {
                throw FrakError.internalFailure(
                    message: "the device refused the key material an anonymous id needs"
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
                    seededReward: seeded,
                    language: language
                ),
                // Rebuilt from the same resolved config as `pageURL`: if the pool warmed against
                // anything else the strings differ and the session does a full load instead.
                warmBaseURL: SharingPageURL.warm(
                    walletOrigin: walletOrigin,
                    merchantId: config.merchantId,
                    clientId: clientId,
                    bundleId: bundleId,
                    appName: name,
                    logoURL: config.displayLogoURL,
                    language: language
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
            if let webView { navigateNow(webView, navigation) }
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
