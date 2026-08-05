#if canImport(UIKit)
    import Foundation
    import FrakSDK

    /// One sharing session, started at the tap rather than at the sheet's first render.
    ///
    /// This exists because of what presenting costs. A `.sheet` builds a `UIHostingController`,
    /// a presentation controller and a new window-level container, and the pooled web view is
    /// attached and laid out in the same frames — the main actor is occupied for the whole
    /// present-and-animate. Anything sequenced *inside* that presentation queues behind it,
    /// which is where the session build and then the navigation each lose their turn.
    ///
    /// `start` is called from the presenter's `launch`, i.e. on the update that flipped
    /// `isPresented`, before SwiftUI has begun presenting anything: it takes the pooled view,
    /// hands it to the model, starts the build off the main actor and issues the navigation
    /// itself. The sheet then renders a session that is already under way rather than starting
    /// one.
    @MainActor
    final class SharingPresentation {
        let model: SharingSheetModel
        let webView: SharingWebView

        private let pool: SharingWebViewPool
        /// The build. Held so `dispose` can cancel it rather than leave network and keystore work
        /// running for a sheet that has gone.
        private var preparation: Task<Void, Never>?
        private var disposed = false

        /// Whether a sheet ever took ownership of this session.
        ///
        /// Decides *which* teardown signal disposes it. A presented sheet is disposed from
        /// `onDismiss`, which SwiftUI calls after the dismissal animation — releasing the pooled
        /// view earlier would start its re-warm reload on a view still animating off screen. A
        /// session that reported a terminal outcome before any sheet appeared gets no `onDismiss`
        /// at all, and is disposed from the `isPresented` change instead.
        private(set) var wasPresented = false

        private init(model: SharingSheetModel, webView: SharingWebView, pool: SharingWebViewPool) {
            self.model = model
            self.webView = webView
            self.pool = pool
        }

        /// The sheet is on screen and owns this session's teardown from here.
        func onPresented() {
            wasPresented = true
        }

        /// Idempotent — the presenter reaches it from both `onDismiss` and the `isPresented`
        /// change that accompanies it.
        ///
        /// Deliberately not driven by the sheet content's `.onDisappear`: that also fires when a
        /// `UIActivityViewController` covers the sheet, and handing the view back to the pool
        /// mid-share would take the confirmation screen away from a live session.
        func dispose() {
            guard !disposed else { return }
            disposed = true
            // Before anything that could make the model report. `release()` deliberately does not
            // mark the model closed — an in-flight `share` outlives the sheet that started it —
            // so a build still suspended here will still run its failure path to completion. Those
            // closures write the *presenter's* `best` and flip its `isPresented`, which by then may
            // belong to the next session: a late failure from a dismissed sheet could otherwise
            // poison a later sheet's reported outcome, or dismiss a live one outright.
            model.onOutcome = nil
            model.onClose = nil
            preparation?.cancel()
            preparation = nil
            model.release()
            pool.release(webView)
        }

        static func start(
            pool: SharingWebViewPool,
            request: SharingRequest,
            onOutcome: @escaping (SharingResult) -> Void,
            onClose: @escaping () -> Void
        ) -> SharingPresentation {
            let trace = SharingTrace()
            let sessionId = UUID().uuidString.lowercased()

            // Taken before the model exists, because whether this view is a finished warm page
            // decides how the session navigates — and the model needs that answer at
            // construction. Bound here only by session id, which is already enough to make the
            // view reject a late callback from the sheet that closed before this one.
            let webView = pool.acquire(SharingWebViewBinding(sessionId: sessionId))

            // A fragment activation is only same-document if the document is actually there.
            // Warming is usually still in flight at tap, and hanging a fragment off a
            // half-loaded page would strand it: nothing would ever finish the load.
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

            // Attach before start: whichever finishes second issues the navigation, and the view
            // is ready long before the build can be.
            model.attach(webView)

            let presentation = SharingPresentation(model: model, webView: webView, pool: pool)
            presentation.preparation = Task { await model.start(request) }
            return presentation
        }
    }

    /// Owns the share surface's warm view pool and whatever session is currently up.
    ///
    /// The iOS twin of Android's `SharingHost`, with one structural difference: a
    /// merchant flips a `Binding<Bool>` rather than calling a method, so "the tap" is the update
    /// in which `isPresented` becomes true. `launch` is idempotent so the sheet's own `onAppear`
    /// can re-ask without risk if that update ever lands after the sheet is built.
    @MainActor
    final class SharingPresenter: ObservableObject {
        @Published private(set) var presentation: SharingPresentation?

        private var pool: SharingWebViewPool?
        /// Set by `launch`, cleared by `finish`, so a `finish` that follows a launch reports
        /// exactly once and one that follows nothing reports not at all.
        private var launched = false

        /// Warms the data the sheet needs before it can build a URL at all, then the page itself.
        ///
        /// The web view is only half of the tap-to-paint cost; the other half is the session
        /// build, which cannot start until `buildLink`, `anonymousId` and `resolveConfig` have
        /// all answered. Both reads are memoised inside the SDK, so this is purely about paying
        /// for them while the user is still looking at the merchant's screen.
        ///
        /// Resolving the config is also what unlocks warming the *real* page rather than a
        /// neutral one — the merchantId is the thing the page needs before it can boot its
        /// queries, and it does not exist any earlier. That is why the pool is warmed from here.
        ///
        /// Gated on `FrakConfig.preloadSharing`: doing work ahead of an intent the user has not
        /// expressed yet is exactly what that flag opts into. The reward is deliberately not
        /// warmed — `RewardRepository`'s cache is keyed on the encoded product list, so a warm-up
        /// without the request's products mints a different key and buys the sheet nothing.
        func warm() async {
            guard Frak.isInitialized, Frak.preloadSharing, let client = try? Frak.client else { return }
            let trace = SharingTrace()
            let walletOrigin = client.environment.wallet
            let bundleId = Bundle.main.bundleIdentifier ?? ""

            // The keystore mint is already eager at initialize; awaiting it here only guarantees
            // the sheet's own read lands on a settled value rather than joining one in flight.
            guard let clientId = await client.anonymousId else { return }
            trace.mark("warm identity ready")

            // A warm-up that fails is not a failure: the sheet re-resolves and carries its own
            // tier-3 fallback for the case where that fails too. But without both halves of the
            // identity the page would render nothing, and warming a page that renders nothing
            // banks only DNS/TLS/bundle — not the queries, which are the expensive part.
            guard let config = try? await client.config.resolve() else { return }
            trace.mark("warm config ready")

            poolIfPossible()?
                .warm(
                    SharingPageURL.warm(
                        walletOrigin: walletOrigin,
                        merchantId: config.merchantId,
                        clientId: clientId,
                        bundleId: bundleId,
                        appName: config.sdkConfig?.name ?? config.name,
                        logoURL: config.sdkConfig?.logoURL
                    )
                )
        }

        /// Starts the session. A second call while one is up is a no-op rather than a replacement.
        ///
        /// Reports `.notInitialized` rather than presenting an empty sheet when `Frak.initialize`
        /// has not run: there is no wallet origin to load and no client to build a link from.
        func launch(
            _ request: SharingRequest,
            onOutcome: @escaping (SharingResult) -> Void,
            onClose: @escaping () -> Void
        ) {
            // `launched`, not `presentation == nil`: a launch that could not build one (no
            // `Frak.initialize`) has still reported its failure, and re-running it from the
            // sheet's `onAppear` would report the same failure twice.
            guard !launched else { return }
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

        /// The sheet is on screen. From here `onDismiss` owns teardown; see
        /// `SharingPresentation.wasPresented`.
        func onPresented() {
            presentation?.onPresented()
        }

        /// The sheet has gone. Returns whether a launch was outstanding, so the caller reports its
        /// aggregated outcome exactly once across `onDismiss` and the `isPresented` change that
        /// accompanies it.
        ///
        /// - Parameter onlyIfUnpresented: pass true from the `isPresented` change. That fires as
        ///   soon as the flag flips, which for an SDK-driven close is *before* the dismissal
        ///   animation — disposing there would hand the view back to the pool, which immediately
        ///   reloads it to the warm URL, while it is still visibly animating away. A presented
        ///   sheet is left to `onDismiss`; one that never appeared has no `onDismiss` coming and
        ///   must be finished here.
        /// - Returns: whether this call is the one that should report the session's outcome.
        func finish(onlyIfUnpresented: Bool = false) -> Bool {
            guard launched else { return false }
            if onlyIfUnpresented, presentation?.wasPresented == true { return false }
            launched = false
            presentation?.dispose()
            presentation = nil
            return true
        }

        /// The share surface has left the screen; the pooled view's timers and process go with it.
        func teardown() {
            pool?.destroy()
            pool = nil
        }

        /// Nil before `Frak.initialize`, which has no wallet origin to boot a view against.
        ///
        /// Built lazily rather than at construction for exactly that reason, and kept for the
        /// life of the surface: `teardown` is the only thing that drops it.
        private func poolIfPossible() -> SharingWebViewPool? {
            guard Frak.isInitialized, let client = try? Frak.client else { return nil }
            if let pool { return pool }
            let created = SharingWebViewPool(
                walletOrigin: client.environment.wallet,
                preload: Frak.preloadSharing
            )
            pool = created
            return created
        }
    }
#endif
