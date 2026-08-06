#if canImport(UIKit)
    import FrakSDK
    import SwiftUI

    extension View {
        /// Presents the Frak sharing sheet while `isPresented` is true. Hoist onto a screen-level
        /// view, not a list row: with `FrakConfig.preloadSharing` that warms one view per row.
        ///
        /// - Parameter heightFraction: fraction of screen height, clamped to `0.3...1.0`.
        /// - Parameter onResult: called once per presentation with the most significant outcome.
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

        /// A `@StateObject` because it outlives every sheet this modifier presents — the pooled
        /// web view is the whole point.
        @StateObject private var presenter = SharingPresenter()

        /// The most significant outcome so far, so a user who swipes the sheet away after
        /// sharing is still reported as having shared.
        @State private var best: SharingResult?

        func body(content: Content) -> some View {
            content
                .task { await presenter.warm() }
                .onDisappear { presenter.teardown() }
                // The tap: SwiftUI has not begun presenting yet, so the pooled view is taken and
                // the build started first. `false` is handled here only for a session that never
                // got a sheet, and so has no `onDismiss` coming.
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
                        // Idempotent safety net if the `onChange` lands after the sheet is built.
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

        /// The single exit, whether the sheet closed itself or the user swiped it away.
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
            // and does not shrink for Slide Over/Split View on iPad.
            GeometryReader { proxy in
                let sheetHeight = proxy.size.height * clampedSharingHeightFraction(heightFraction)
                ZStack {
                    if let presentation = presenter.presentation {
                        PresentedSharingSession(presentation: presentation)
                    } else {
                        SharingSheetSkeleton()
                    }
                }
                .frame(height: sheetHeight)
                // Without this the system sheet background shows as a seam wherever the page
                // doesn't reach. iOS 16.4+ only.
                .modifier(ClearSheetBackground())
            }
            .onAppear {
                launch()
                // From here the sheet owns teardown, not the `isPresented` change.
                presenter.onPresented()
            }
        }
    }

    /// The web view, with the skeleton stacked over it until the page has painted.
    ///
    /// A cross-fade rather than a swap, so the page is never revealed mid-layout.
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
            // Bounds how long the skeleton may cover the page when `SharingPageAction.ready`,
            // the real paint signal, never arrives.
            .task(id: model.pageLoaded) {
                let hold = model.pageLoaded ? Self.skeletonGrace : Self.skeletonMaxHold
                try? await Task.sleep(nanoseconds: UInt64(hold * 1_000_000_000))
                guard !Task.isCancelled else { return }
                model.onPageVisible()
            }
        }

        private static let fadeDuration = 0.18
        /// Longest the skeleton may cover a page whose document has not finished. Above the
        /// tier-3 deadline by design.
        private static let skeletonMaxHold: TimeInterval = 2.5
        private static let skeletonGrace: TimeInterval = 0.4
    }

    /// Clears the sheet's own background where the OS allows it. A modifier rather than an
    /// inline `if #available`: the two branches return different opaque types.
    private struct ClearSheetBackground: ViewModifier {
        func body(content: Content) -> some View {
            if #available(iOS 16.4, *) {
                content.presentationBackground(.clear)
            } else {
                content
            }
        }
    }
#endif
