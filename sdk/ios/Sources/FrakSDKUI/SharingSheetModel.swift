#if canImport(UIKit)
    import Foundation
    import FrakSDK
    import SwiftUI
    import UIKit

    // `SharingSession` and `sharingDecision` live in SharingSheetLogic.swift, outside this
    // file's `#if canImport(UIKit)`, so they stay reachable from a macOS test host.

    /// The sheet's behaviour, kept out of the view.
    ///
    /// The ordering rules that matter — queue the interaction before the OS share sheet,
    /// reload with `&confirmed=1` after it, never fall back twice — are sequencing, and
    /// sequencing inside a re-evaluating `body` is where this kind of flow goes wrong.
    @MainActor
    final class SharingSheetModel: ObservableObject {
        /// Tap-to-content budget, timed from the sheet appearing rather than from the page
        /// starting to load: it has to cover `buildSharingLink` and `resolveConfig` too.
        static let pageLoadDeadline: TimeInterval = 1.5
        /// How long the reward headline may delay the page URL. Past it the page fetches its
        /// own, and the first frame simply has no headline.
        static let seedTimeout: TimeInterval = 0.15

        @Published private(set) var webView: SharingWebView?
        @Published private(set) var copyConfirmed = false

        /// Every outcome as it happens; the caller keeps the most significant.
        var onOutcome: ((SharingResult) -> Void)?
        /// Asks the presenter to take the sheet down.
        var onClose: (() -> Void)?

        private let sessionId = UUID().uuidString.lowercased()
        private let client: () -> (any FrakClient)?

        private var session: SharingSession?
        private var deadline: Task<Void, Never>?
        private var started = false
        private var closed = false
        private var pageLoaded = false
        /// The 1.5s budget and the page's own load failure are independent triggers on the
        /// same session, and offline both fire. Without this, one share would queue two
        /// `sharing` interactions and stack two OS choosers on the user.
        private var fellBack = false
        private var deadlineExpired = false

        init(client: @escaping () -> (any FrakClient)? = { try? Frak.client }) {
            self.client = client
        }

        /// Idempotent: `onAppear` can fire more than once for the same presentation, and a
        /// second preparation would double every event this one queues.
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

        func release() {
            // Deliberately does NOT set `closed`, and does not cancel `prepare`. `.onDisappear`
            // also fires when `UIActivityViewController` covers the sheet, and both `share` and
            // the tier-3 fallback suspend across exactly that window — suppressing outcomes here
            // would report `.dismissed` for a share that succeeded. Audit §6's late-`report`
            // concern needs a signal that distinguishes "covered" from "dismissed", which cannot
            // be settled without a device.
            deadline?.cancel()
            deadline = nil
            webView?.stop()
            webView = nil
        }

        /// The user tapped Share.
        func share() async {
            guard let session else { return }
            // Durable before the chooser opens: iOS can suspend the host app while the OS
            // share sheet is foregrounded, and an event only recorded on the callback is lost.
            await trackSharing()
            guard await NativeShare.share(link: session.link, title: session.shareTitle) else { return }
            confirm(.shared(link: session.link))
        }

        /// The user tapped Copy link.
        func copy() async {
            guard let session else { return }
            await trackSharing()
            NativeShare.copy(session.link)
            copyConfirmed = true
            confirm(.copied(link: session.link))
        }

        func onPageReady() {
            pageLoaded = true
            settleContent()
        }

        /// The web view gave up, tier-2 retry included.
        func onPageUnavailable() {
            // Same predicate as the deadline: `pageLoaded` matters because a content-process crash
            // after the page painted arrives here too, and a chooser on top of a sheet the user is
            // using would be a share they never asked for. `deadlineExpired: true` because there
            // is no page left to spend the budget on either way.
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
                    _ = await client()?.openFrakApp()
                    report(.installStarted)
                    close()
                }
            case .shareAgain:
                if let url = session?.url(confirmed: false) {
                    webView?.load(url)
                }
            case .dismiss:
                close()
            case .error:
                fail(.decoding(message: "the sharing page refused to render"))
            }
        }

        func openExternally(_ url: URL) {
            // The page chooses this URL. Anything but http(s) is an app-to-app launch the
            // merchant never sanctioned, reaching whatever handler is registered on the device.
            guard url.scheme == "https" || url.scheme == "http" else { return }
            Task { _ = await UIApplication.shared.open(url) }
        }

        private func prepare(_ request: SharingRequest) async {
            guard let client = client() else {
                fail(.notInitialized)
                return
            }

            let built: SharingSession
            do {
                built = try await build(client: client, request: request)
            } catch let error as FrakError {
                fail(error)
                return
            } catch {
                fail(.decoding(message: "unexpected failure: \(error.localizedDescription)"))
                return
            }

            session = built
            // Either the budget is already gone, or there is no page to spend it on. `closed`
            // matters here too: the sheet can reach a terminal outcome while `build` is still
            // suspended, and a web view built after that would never be seen.
            let url: URL
            switch sharingDecision(
                session: built,
                deadlineExpired: deadlineExpired,
                pageLoaded: pageLoaded,
                fellBack: fellBack,
                closed: closed
            ) {
            case .showPage(let pageURL):
                url = pageURL
            case .nativeShare(let session):
                await fallBack(to: session)
                return
            case .doNothing:
                return
            }

            let webView = SharingWebView(
                walletOrigin: built.walletOrigin,
                returnScheme: built.returnScheme,
                sessionId: sessionId,
                onAction: { [weak self] in self?.onPageAction($0) },
                onPageReady: { [weak self] in self?.onPageReady() },
                onLoadFailed: { [weak self] in self?.onPageUnavailable() },
                onOpenExternal: { [weak self] in self?.openExternally($0) }
            )
            webView.load(url)
            self.webView = webView
        }

        private func build(client: any FrakClient, request: SharingRequest) async throws -> SharingSession {
            guard let link = await client.buildSharingLink(request), let clientId = client.anonymousId else {
                // The one failure the fallback cannot help with: there is no link to share.
                throw FrakError.merchantResolutionFailed(
                    reason: "no anonymous id or merchant to build a sharing link from"
                )
            }

            let walletOrigin = client.environment.wallet
            let bundleId = Bundle.main.bundleIdentifier ?? ""
            let returnScheme = SharingPageURL.returnScheme(bundleId: bundleId)

            let config: FrakResolvedConfig
            do {
                config = try await client.resolveConfig()
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

            let name = config.sdkConfig?.name ?? config.name
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
                    logoURL: request.logoURL ?? config.sdkConfig?.logoURL,
                    link: request.link ?? request.products.first?.link,
                    products: Self.productsJSON(request.products),
                    seededReward: await seededReward(client: client, request: request)
                )
            )
        }

        /// A cached headline for the first frame, or nothing. Bounded, because the page is
        /// worth more than the headline on it.
        private func seededReward(client: any FrakClient, request: SharingRequest) async -> String? {
            let timeout = Self.seedTimeout
            let targetInteraction = request.targetInteraction
            return await withTaskGroup(of: String?.self) { group in
                group.addTask {
                    try? await client.bestReward(targetInteraction: targetInteraction)?.formatted
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

            await trackSharing()
            let shared = await NativeShare.share(link: session.link, title: session.shareTitle)
            report(shared ? .shared(link: session.link) : .dismissed)
            close()
        }

        private func trackSharing() async {
            _ = await client()?.track(.sharing())
        }

        /// Records an outcome the sheet stays open after, and reloads the page onto its
        /// post-share state — without `confirmed=1` the page just sits there, since under
        /// `native=1` its own controls are hidden.
        private func confirm(_ result: SharingResult) {
            report(result)
            if let url = session?.url(confirmed: true) {
                webView?.load(url)
            }
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

        /// The page's router parses search values as JSON. Nil rather than `[]`, because the
        /// page skips the card section on an absent value and renders an empty one on `[]`.
        private static func productsJSON(_ products: [SharingProduct]) -> String? {
            guard !products.isEmpty else { return nil }
            let array = products.map { product -> [String: Any] in
                let fields: [String: Any?] = [
                    "title": product.title,
                    "link": product.link,
                    "imageUrl": product.imageURL,
                    "utmContent": product.utmContent,
                ]
                return fields.compactMapValues { $0 }
            }
            guard let data = try? JSONSerialization.data(withJSONObject: array, options: [.sortedKeys]) else {
                return nil
            }
            return String(data: data, encoding: .utf8)
        }
    }
#endif
