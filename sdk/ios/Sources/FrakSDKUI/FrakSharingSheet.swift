#if canImport(UIKit)
    import FrakSDK
    import SwiftUI

    extension View {
        /// Presents the Frak sharing sheet while `isPresented` is true.
        ///
        /// ```swift
        /// Button("Share") { isSharing = true }
        ///     .frakSharingSheet(isPresented: $isSharing, request: SharingRequest(link: product.url)) { result in
        ///         // .installStarted is informational — the SDK owns the install flow
        ///     }
        /// ```
        ///
        /// `onResult` is called once per presentation with the most significant outcome:
        /// install beats a share or a copy, which beat a dismissal. Hoist this onto a
        /// screen-level view rather than a list row — with `FrakConfig.preloadSharing` on,
        /// one per row means one warm web view per row.
        ///
        /// `heightFraction` is the fraction of screen height given to the sheet, clamped to
        /// `0.3...1.0`, defaulting to `FrakSharingDefaults.heightFraction`.
        public func frakSharingSheet(
            isPresented: Binding<Bool>,
            request: SharingRequest,
            heightFraction: CGFloat = FrakSharingDefaults.heightFraction,
            onResult: @escaping (SharingResult) -> Void = { _ in }
        ) -> some View {
            modifier(
                FrakSharingSheetModifier(
                    isPresented: isPresented,
                    request: request,
                    heightFraction: heightFraction,
                    onResult: onResult
                )
            )
        }
    }

    private struct FrakSharingSheetModifier: ViewModifier {
        @Binding var isPresented: Bool
        let request: SharingRequest
        let heightFraction: CGFloat
        let onResult: (SharingResult) -> Void

        /// Owns the warm view pool and the live session. A `@StateObject` because it outlives
        /// every sheet this modifier presents — the pooled web view is the whole point.
        @StateObject private var presenter = SharingPresenter()

        /// The most significant outcome so far, so a user who swipes the sheet away after
        /// sharing is still reported as having shared.
        @State private var best: SharingResult?

        func body(content: Content) -> some View {
            content
                // This modifier existing is the share surface becoming visible, which is the
                // earliest honest moment to start warming: the identity and config reads the
                // session cannot build a URL without, and then the merchant's own page.
                .task { await presenter.warm() }
                .onDisappear { presenter.teardown() }
                // The tap. `isPresented` becomes true in this update, and SwiftUI has not begun
                // presenting anything yet — so the pooled view is taken, the build started and
                // the navigation issued before the sheet's own presentation work begins. This is
                // the whole reason the session does not start inside the sheet.
                //
                // `false` is handled here *only* for a session that never got a sheet: one that
                // reports a terminal outcome before SwiftUI presents anything closes itself, and
                // no `onDismiss` fires for a sheet that was never presented. Everything else is
                // left to `onDismiss`, which lands after the dismissal animation — finishing here
                // would return the web view to the pool, which reloads it to the warm URL, while
                // it is still animating off screen.
                .onChange(of: isPresented) { presenting in
                    if presenting {
                        launch()
                    } else {
                        finish(onlyIfUnpresented: true)
                    }
                }
                .sheet(isPresented: $isPresented, onDismiss: { finish() }) {
                    FrakSharingSheetContent(
                        presenter: presenter,
                        heightFraction: heightFraction,
                        // Idempotent, and a safety net rather than the main path: if the
                        // `onChange` above ever lands after the sheet is built, the session still
                        // starts — one frame later, which is exactly today's behaviour.
                        launch: launch
                    )
                }
        }

        private func launch() {
            presenter.launch(
                request,
                onOutcome: { result in
                    if result.significance > (best?.significance ?? -1) {
                        best = result
                    }
                },
                onClose: { isPresented = false }
            )
        }

        /// The single exit, whether the sheet closed itself or the user swiped it away. Idempotent
        /// across the two signals that reach it.
        private func finish(onlyIfUnpresented: Bool = false) {
            guard presenter.finish(onlyIfUnpresented: onlyIfUnpresented) else { return }
            onResult(best ?? .dismissed)
            best = nil
        }
    }

    private struct FrakSharingSheetContent: View {
        @ObservedObject var presenter: SharingPresenter
        let heightFraction: CGFloat
        let launch: () -> Void

        var body: some View {
            // `GeometryReader`, not `UIScreen.main.bounds`: the latter is the physical display
            // and does not shrink for Slide Over/Split View on iPad. `.presentationDetents` was
            // evaluated for a tighter sheet but needs the page's own height, not knowable from
            // here without a second measurement pass.
            GeometryReader { proxy in
                let sheetHeight = proxy.size.height * clampedSharingHeightFraction(heightFraction)
                ZStack {
                    if let presentation = presenter.presentation {
                        PresentedSharingSession(presentation: presentation)
                    } else {
                        // No session yet — the `onAppear` below is about to start one. The
                        // skeleton is the honest placeholder for that, and the same one the
                        // session will keep showing until the page paints.
                        SharingSheetSkeleton()
                    }
                }
                .frame(height: sheetHeight)
                // The page paints the only surface in this sheet; without this the system sheet
                // background shows as a seam wherever the page doesn't reach. iOS 16.4+ only —
                // below it the WebView filling the sheet hides the difference.
                .modifier(ClearSheetBackground())
            }
            .onAppear {
                launch()
                // From here the sheet owns teardown; before this frame the `isPresented` change
                // did. See `SharingPresentation.wasPresented`.
                presenter.onPresented()
            }
        }
    }

    /// The web view, with the skeleton stacked over it until the page has painted.
    ///
    /// A cross-fade rather than a swap: the web view keeps painting underneath the whole time, so
    /// the page is never revealed mid-layout. The skeleton leaves the hierarchy once transparent,
    /// so its pulse stops animating.
    private struct PresentedSharingSession: View {
        let presentation: SharingPresentation
        @ObservedObject private var model: SharingSheetModel

        init(presentation: SharingPresentation) {
            self.presentation = presentation
            self._model = ObservedObject(wrappedValue: presentation.model)
        }

        var body: some View {
            ZStack {
                SharingWebViewContainer(webView: presentation.webView)

                if !model.pageVisible {
                    SharingSheetSkeleton()
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: Self.fadeDuration), value: model.pageVisible)
            // Bounds how long the skeleton may cover the page. `SharingPageAction.ready` is the
            // real paint signal; this is what happens when one never arrives — an older wallet
            // build, or a page that errored before its effects ran. Short once the document has
            // finished, long enough otherwise that the tier-3 deadline settles the sheet first.
            .task(id: model.pageLoaded) {
                let hold = model.pageLoaded ? Self.skeletonGrace : Self.skeletonMaxHold
                try? await Task.sleep(nanoseconds: UInt64(hold * 1_000_000_000))
                guard !Task.isCancelled else { return }
                model.onPageVisible()
            }
        }

        private static let fadeDuration = 0.18
        /// Longest the skeleton may cover a page whose document has not even finished. Above the
        /// tier-3 deadline by design.
        private static let skeletonMaxHold: TimeInterval = 2.5
        /// Longest it may cover a finished document that produced no paint signal.
        private static let skeletonGrace: TimeInterval = 0.4
    }

    /// Clears the sheet's own background where the OS allows it. A modifier rather than an
    /// inline `if #available`: the two branches return different opaque types, which `some
    /// View` cannot express without erasing to `AnyView`.
    private struct ClearSheetBackground: ViewModifier {
        func body(content: Content) -> some View {
            if #available(iOS 16.4, *) {
                content.presentationBackground(.clear)
            } else {
                // Below 16.4: the page fills the sheet, so the system background is only
                // visible behind the corner radius.
                content
            }
        }
    }
#endif
