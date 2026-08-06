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
        func dispose() {
            guard !disposed else { return }
            disposed = true
            // Clear the callbacks first: an in-flight build outlives the sheet, and its late
            // failure would otherwise write the presenter state of the *next* session.
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

        /// Warms the data the sheet needs before it can build a URL at all, then the page itself.
        ///
        /// Gated on `FrakConfig.preloadSharing`. The reward is not warmed: its cache key
        /// includes the request's products, which are unknown here.
        func warm() async {
            guard Frak.isInitialized, Frak.preloadSharing, let client = try? Frak.client else { return }
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
        /// - Parameter onlyIfUnpresented: pass true from the `isPresented` change, which fires
        ///   before the dismissal animation; a presented sheet is left to `onDismiss`.
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
