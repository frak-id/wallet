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
        private var settled = false

        /// A strong reference to itself, held only across a deferred teardown.
        ///
        /// `SharingPresenter.finish` nils its own `presentation` before calling `dispose`, and the
        /// completion `dispose` hands to the model captures `self` weakly — so on the deferred path
        /// nothing else is left holding this presentation, it deallocates, and the completion finds
        /// itself gone. That silently drops the merchant's `onResult` and leaves
        /// `SharingPresenter.disposing` stuck true, wedging every later sheet: the exact failure the
        /// deferral exists to prevent, in exactly the case it exists for. `settle` clears this, and
        /// `abandonGrace` guarantees `settle` runs, so the cycle is bounded rather than a leak.
        private var selfUntilSettled: SharingPresentation?

        /// How long a teardown waits for an in-flight attribution before closing the outcome
        /// channel anyway. Only a hung `NativeShare` chooser ever reaches it.
        private static let abandonGrace: TimeInterval = 5

        /// Whether a sheet took ownership; decides which teardown signal disposes this.
        private(set) var wasPresented = false

        private init(model: SharingSheetModel, webView: SharingWebView, pool: SharingWebViewPool) {
            self.model = model
            self.webView = webView
            self.pool = pool
        }

        func onPresented() {
            wasPresented = true
        }

        /// Idempotent, and deliberately not driven by `.onDisappear`, which also fires when a
        /// `UIActivityViewController` covers the sheet.
        ///
        /// - Parameter onSettled: called exactly once — synchronously if nothing was resolving, or
        ///   later once `SharingSheetModel.abandon(onSettled:)` decides it can proceed. The model
        ///   and the pooled web view are released immediately either way; only the outcome channel
        ///   waits, which is the whole of what a deferred outcome needs.
        func dispose(onSettled: @escaping () -> Void) {
            guard !disposed else {
                onSettled()
                return
            }
            disposed = true
            // Cancel first, regardless of what `abandon` decides below: this is the *other*
            // protection dispose has always given, for a stale build's own `prepare()` task, not
            // for share/copy/fallback. Cancelling it early stops it from resuming into a build
            // this presentation no longer wants, cooperative cancellation notwithstanding.
            preparation?.cancel()
            preparation = nil
            // Resources go back now, not when the deferral settles, which is also all Android's
            // `abandon` defers — the `Dismissed` report, never the teardown. That distinction is
            // load-bearing here: `NativeShare.share()` can hang when a chooser is accepted and then
            // torn down (its own doc says so), and a hang that also held the pooled web view would
            // leave it marked lent forever, handing every later session a cold one. An in-flight
            // attribution needs none of this — `copy()` and `fallBack(to:)` never touch the web
            // view, and `share()`'s post-share `confirm()` navigation is moot on a sheet already gone.
            model.release()
            pool.release(webView)
            // Set before asking, since `abandon` may settle synchronously and clear it again.
            selfUntilSettled = self
            model.abandon { [weak self] in
                self?.settle(onSettled)
            }
            // Bound the wait for the same hang. Unbounded, it would cost the merchant this
            // session's `onResult` entirely and leave `SharingPresenter.disposing` stuck true, so
            // the sheet could never open again — a worse failure than the `.dismissed` race 9.1
            // is about. Comfortably longer than a chooser plus the tracking call behind it.
            guard !settled else { return }
            Task { @MainActor [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(Self.abandonGrace * 1_000_000_000))
                self?.settle(onSettled)
            }
        }

        /// One-shot: whichever of the deferral and its bound arrives first closes the session.
        ///
        /// Nilling the callbacks is what stops a stale, cancelled build from a previous session
        /// writing into whatever session replaced it. It waits, unlike the release above: this is
        /// the channel a deferred real outcome still has to travel down.
        private func settle(_ onSettled: () -> Void) {
            guard !settled else { return }
            settled = true
            model.onOutcome = nil
            model.onClose = nil
            // Moved to a local before the property is cleared: `selfUntilSettled` may hold the last
            // reference to `self`, and releasing it inline would deallocate this object while it is
            // still running. `withExtendedLifetime` keeps it past `onSettled`, which the optimizer
            // is otherwise free to release before.
            let keepAlive = selfUntilSettled
            selfUntilSettled = nil
            onSettled()
            withExtendedLifetime(keepAlive) {}
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
        @Published private(set) var presentation: SharingPresentation?

        private var pool: SharingWebViewPool?
        private var launched = false
        /// True from the moment `finish(onSettled:)` defers to an in-flight attribution until
        /// that attribution's own completion actually tears the presentation down. Without this,
        /// `launched` already reads false during the deferral (see `finish`), and a launch in
        /// that window would hand a fresh model the same `best`/`isPresented` state the deferred
        /// one is still about to write into.
        private var disposing = false

        /// A launch that arrived during that window, replayed once it closes.
        ///
        /// Dropping it instead would not just lose a tap: SwiftUI presents the `.sheet` off the
        /// same `isPresented` binding regardless, so the user would be left looking at a skeleton
        /// with no session behind it and nothing to re-ask.
        private var pendingLaunch: (() -> Void)?

        /// What a held launch is owed when its own binding closes before it can be replayed.
        ///
        /// It never became a session, but SwiftUI did present a sheet for it, so it is a
        /// presentation and `onResult` is promised one report per presentation. Queued rather than
        /// called on the spot so it lands after the outcome the deferral is still resolving.
        private var pendingReports: [() -> Void] = []

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
            // `launched`, not `presentation == nil`: a launch that could not build one has still
            // reported its failure, and must not report it twice.
            guard !launched else { return }
            // A previous session's dismissal is still deferred to an in-flight attribution, so a
            // fresh model would race it for `best`/`isPresented` — see `disposing`. Held rather
            // than dropped: the sheet SwiftUI is presenting has nothing else coming.
            guard !disposing else {
                pendingLaunch = { [weak self] in
                    self?.launch(request, onOutcome: onOutcome, onClose: onClose)
                }
                return
            }
            launched = true
            guard let pool = poolIfPossible() else {
                onOutcome(.failed(.notInitialized))
                onClose()
                return
            }
            presentation = SharingPresentation.start(
                pool: pool,
                request: request,
                onOutcome: onOutcome,
                onClose: onClose
            )
        }

        func onPresented() {
            presentation?.onPresented()
        }

        /// The sheet has gone.
        ///
        /// - Parameters:
        ///   - onlyIfUnpresented: pass true from the `isPresented` change, which fires before the
        ///     dismissal animation; a presented sheet is left to `onDismiss`.
        ///   - onSettled: the merchant-visible report. Called synchronously unless a share/copy/
        ///     fallback attribution is still resolving, in which case `SharingPresentation.dispose`
        ///     defers it — see that method's doc. Never called at all when this call itself is a
        ///     no-op (not launched, or `onlyIfUnpresented` with a presented sheet still up).
        func finish(onlyIfUnpresented: Bool = false, onSettled: @escaping () -> Void) {
            // The binding has gone false, so a launch held during a deferral is superseded — but
            // it was presented, so it is owed the report this call carries. Ahead of the guard
            // below, which a held launch would otherwise slip past: `launched` reads false for
            // the whole time one is held.
            if pendingLaunch != nil {
                pendingLaunch = nil
                pendingReports.append(onSettled)
            }
            guard launched else { return }
            if onlyIfUnpresented, presentation?.wasPresented == true { return }
            launched = false
            guard let current = presentation else {
                presentation = nil
                onSettled()
                return
            }
            presentation = nil
            disposing = true
            current.dispose { [weak self] in
                self?.disposing = false
                // Before the replay: `onSettled` is what hands the merchant this session's
                // result and resets the caller's `best`, and a session launched before that
                // would fold its own outcomes into the previous one's.
                onSettled()
                self?.drainPending()
            }
        }

        /// Settles everything that was waiting on the deferral this dispose completed: first the
        /// reports owed to launches their own binding closed, then the one launch still standing.
        private func drainPending() {
            let reports = pendingReports
            pendingReports = []
            reports.forEach { $0() }
            guard let pending = pendingLaunch else { return }
            pendingLaunch = nil
            pending()
        }

        /// The share surface has left the screen; the pooled view's timers and process go with it.
        func teardown() {
            // A held launch dies with the surface: replaying it would rebuild a pool for a screen
            // that has gone. `pendingReports` is left alone — the dispose that owes them still
            // completes, and a report is owed whether or not its screen is still up.
            pendingLaunch = nil
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
