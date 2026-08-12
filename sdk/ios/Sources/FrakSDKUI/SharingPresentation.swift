#if canImport(UIKit)
    import Foundation
    import FrakSDK

    /// One sharing session, started at the tap rather than at the sheet's first render.
    ///
    /// Presenting a `.sheet` occupies the main actor for the whole present-and-animate, so the
    /// session build and its navigation are kicked off here, before SwiftUI starts presenting.
    @MainActor
    final class SharingPresentation {
        let model: SharingSheetModel
        let webView: SharingWebView

        private let pool: SharingWebViewPool
        private var preparation: Task<Void, Never>?
        private var disposed = false

        /// Whether a sheet took ownership; decides which teardown signal disposes this.
        private(set) var wasPresented = false

        /// Whether SwiftUI has taken the web view out of the hierarchy, and whether the pool has
        /// had it back. The two are separate because either can happen first.
        private var contentDismantled = false
        private var reclaimed = false

        private init(model: SharingSheetModel, webView: SharingWebView, pool: SharingWebViewPool) {
            self.model = model
            self.webView = webView
            self.pool = pool
        }

        func onPresented() {
            wasPresented = true
        }

        /// SwiftUI has taken this session's web view off screen for good.
        func onContentDismantled() {
            contentDismantled = true
            reclaimWebView()
        }

        /// Hands the pooled view back, at most once, and never before this session is done with it.
        ///
        /// The presenter calls this itself before starting the next session: SwiftUI dismantles a
        /// closed sheet's content *after* the next sheet is already up, so a dismantle left to its
        /// own timing can arrive once the pool has re-lent this very view — and `release` detaches
        /// it and re-warms it, which strands the live sheet on its skeleton showing warm content.
        func reclaimWebView() {
            guard disposed, !reclaimed else { return }
            reclaimed = true
            pool.release(webView)
        }

        /// Ends the session. Idempotent, and deliberately not driven by `.onDisappear`, which also
        /// fires when a `UIActivityViewController` covers the sheet.
        ///
        /// Synchronous: an outcome still resolving when this runs loses to the `.dismissed` the
        /// caller is about to report. That race is a local queue append behind the sheet's own
        /// dismissal animation, and Android accepts the same one on its gesture path — its
        /// `SharingSheetState.dismiss` reports without consulting the in-flight counter, which only
        /// guards host teardown. The multi-second window this used to matter for was the install
        /// action, and `SharingSheetModel` now reports `.installStarted` at the tap instead.
        func dispose() {
            guard !disposed else { return }
            disposed = true
            // Stops a stale build resuming into a session this presentation no longer wants,
            // cooperative cancellation notwithstanding.
            preparation?.cancel()
            preparation = nil
            model.release()
            // A presented sheet still has frames to draw with this view in them, so its own
            // container hands it back from `dismantleUIView`. One that never appeared has no
            // container to do that, and one already dismantled has nothing left to wait for.
            if !wasPresented || contentDismantled { reclaimWebView() }
            // Severs the session: `share()`/`copy()`/`fallBack(to:)` are un-cancelled tasks that
            // outlive the sheet, and their closures write the presenter's `best` and flip its
            // `isPresented` — which by now may belong to the next session.
            model.onOutcome = nil
            model.onClose = nil
        }

        static func start(
            pool: SharingWebViewPool,
            request: SharingRequest,
            onOutcome: @escaping (SharingResult) -> Void,
            onClose: @escaping () -> Void
        ) -> SharingPresentation {
            let trace = SharingTrace()
            let sessionId = UUID().uuidString.lowercased()

            let webView = pool.acquire(SharingWebViewBinding(sessionId: sessionId))

            // A fragment activation is only same-document if the document is actually there;
            // hanging one off a half-loaded page would strand it.
            let activationBaseURL = webView.documentReady ? webView.loadedBaseURL : nil
            switch (activationBaseURL, pool.hasWarmView) {
            case (.some, _): trace.mark("launch (warm view, ACTIVATING)")
            case (nil, true): trace.mark("launch (warm view, still loading)")
            case (nil, false): trace.mark("launch (COLD view)")
            }

            let model = SharingSheetModel(
                sessionId: sessionId,
                trace: trace,
                activationBaseURL: activationBaseURL
            )
            model.onOutcome = onOutcome
            model.onClose = onClose

            webView.bind(
                SharingWebViewBinding(
                    sessionId: sessionId,
                    onAction: { [weak model] in model?.onPageAction($0) },
                    onPageReady: { [weak model] in
                        trace.mark("document finished")
                        model?.onPageReady()
                    },
                    onLoadFailed: { [weak model] in
                        trace.mark("load FAILED")
                        model?.onPageUnavailable()
                    },
                    onOpenExternal: { [weak model] in model?.openExternally($0) }
                )
            )

            // Attach before start: whichever finishes second issues the navigation.
            model.attach(webView)

            let presentation = SharingPresentation(model: model, webView: webView, pool: pool)
            presentation.preparation = Task { await model.start(request) }
            return presentation
        }
    }

    /// Owns the share surface's warm view pool and whatever session is currently up.
    ///
    /// A merchant flips a `Binding<Bool>` rather than calling a method, so `launch` is idempotent
    /// and the sheet's own `onAppear` can re-ask without risk.
    @MainActor
    final class SharingPresenter: ObservableObject {
        /// Where the session is in its life. One value rather than a `launched`/`active` pair,
        /// which could spell states that do not exist.
        private enum Phase {
            case idle
            case live(SharingPresentation)
            /// Launched, but the pool refused it, so its failure is already reported. Not `idle`:
            /// it still owes exactly one `finish`, and must not report twice.
            case reported
        }

        /// What the sheet renders. Deliberately **not** cleared when a session ends: this is
        /// `@Published`, and a presented sheet is finished from inside SwiftUI's dismissal
        /// transaction, where publishing re-presents the sheet. Replaced by the next `launch`,
        /// dropped by `teardown`.
        @Published private(set) var presentation: SharingPresentation?

        private var phase: Phase = .idle
        private var pool: SharingWebViewPool?

        /// Warms the data the sheet needs before it can build a URL at all, then the page itself.
        ///
        /// Driven by attaching the `frakSharingSheet` modifier, which is the only control: iOS has
        /// no other warm entry point, so a merchant does not call this by hand. The reward is not
        /// warmed: its cache key includes the request's products, which are unknown here.
        func warm() async {
            guard Frak.isInitialized, let client = try? Frak.client else { return }
            let trace = SharingTrace()
            let walletOrigin = client.environment.wallet
            let bundleId = Bundle.main.bundleIdentifier ?? ""

            guard let clientId = await client.anonymousId else { return }
            trace.mark("warm identity ready")

            // Without both halves of the identity the page would render nothing, and warming
            // that banks only DNS/TLS/bundle rather than the queries.
            guard let config = try? await client.config.resolve() else { return }
            trace.mark("warm config ready")

            poolIfPossible()?
                .warm(
                    SharingPageURL.warm(
                        walletOrigin: walletOrigin,
                        merchantId: config.merchantId,
                        clientId: clientId,
                        bundleId: bundleId,
                        appName: config.displayName,
                        logoURL: config.displayLogoURL
                    )
                )
        }

        /// Starts the session. A second call while one is up is a no-op rather than a replacement.
        func launch(
            _ request: SharingRequest,
            onOutcome: @escaping (SharingResult) -> Void,
            onClose: @escaping () -> Void
        ) {
            switch phase {
            case .live, .reported:
                // Already up. Both the merchant's binding and the modifier's own `onAppear` ask.
                return
            case .idle:
                // In order, before `acquire` below: the previous session's sheet content may not
                // be dismantled yet, and a dismantle landing after the next session has taken the
                // same view yanks it out from under a live sheet. No-op once it has already run.
                presentation?.reclaimWebView()
            }
            guard let pool = poolIfPossible() else {
                phase = .reported
                onOutcome(.failed(.notInitialized))
                onClose()
                return
            }
            let started = SharingPresentation.start(
                pool: pool,
                request: request,
                onOutcome: onOutcome,
                onClose: onClose
            )
            phase = .live(started)
            presentation = started
        }

        func onPresented() {
            guard case .live(let current) = phase else { return }
            current.onPresented()
        }

        /// The sheet has gone.
        ///
        /// - Parameters:
        ///   - onlyIfUnpresented: pass true from the `isPresented` change, which fires before the
        ///     dismissal animation; a presented sheet is left to `onDismiss`.
        ///   - onSettled: the merchant-visible report, called synchronously. Not called at all when
        ///     this call is a no-op (`idle`, or `onlyIfUnpresented` with a presented sheet up).
        func finish(onlyIfUnpresented: Bool = false, onSettled: () -> Void) {
            switch phase {
            case .idle:
                return
            case .reported:
                phase = .idle
                onSettled()
            case .live(let current):
                if onlyIfUnpresented, current.wasPresented { return }
                // `presentation` is deliberately left pointing at this session — see its doc. The
                // sheet is on its way out and still rendering the page it showed; the next
                // `launch` replaces it.
                phase = .idle
                current.dispose()
                onSettled()
            }
        }

        /// The share surface has left the screen; the pooled view's timers and process go with it.
        func teardown() {
            // A session goes with the surface.
            phase = .idle
            // Ahead of `destroy()`, which refuses to drop a view the pool still thinks is lent.
            presentation?.reclaimWebView()
            // The one place `presentation` is cleared: the surface is gone, so nothing is
            // rendering it and no sheet transaction is in flight to disturb.
            presentation = nil
            pool?.destroy()
            pool = nil
        }

        /// Nil before `Frak.initialize`, which has no wallet origin to boot a view against.
        private func poolIfPossible() -> SharingWebViewPool? {
            guard Frak.isInitialized, let client = try? Frak.client else { return nil }
            if let pool { return pool }
            let created = SharingWebViewPool(walletOrigin: client.environment.wallet)
            pool = created
            return created
        }
    }
#endif
