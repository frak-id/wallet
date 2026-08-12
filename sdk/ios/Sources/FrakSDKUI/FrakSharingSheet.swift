#if canImport(UIKit)
    import FrakSDK
    import SwiftUI

    extension View {
        /// Presents the Frak sharing sheet while `isPresented` is true. Hoist onto a screen-level
        /// view, not a list row: attaching this modifier always warms a pooled `WKWebView`, so one
        /// per row is one engine per row.
        ///
        /// - Parameters:
        ///   - isPresented: whether the sheet is up.
        ///   - request: what to share.
        ///   - heightFraction: fraction of screen height, clamped to `0.3...1.0`.
        ///   - onResult: called once per presentation with the most significant outcome.
        /// - Returns: `content` wrapped with the sheet's presentation, warm-up and teardown.
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
            // Published on every render, not captured by the observers below: `onChange` runs the
            // action the *previous* render registered, which would launch the previous share.
            presenter.pendingRequest = request

            return
                content
                .task { await presenter.warm() }
                // The net for a binding that is already true at first render: `onChange` has no
                // change to observe there, so nothing else would ever start that session. It lives
                // here rather than on the sheet's own content, which SwiftUI can re-insert behind a
                // dismissal — see `SharingPresenter.presentation`. This one runs before SwiftUI
                // presents anything, so it cannot resurrect a finished session.
                .onAppear { if isPresented { launch() } }
                .onDisappear { presenter.teardown() }
                // The tap. Synchronous, and deliberately not `.task(id:)`, which would run after
                // SwiftUI had begun presenting: the sheet's content is built from
                // `presenter.presentation`, so a late launch builds the *previous* session and then
                // replaces it underneath, leaving two identities for one pooled engine.
                // `false` is handled here only for a session that never got a sheet.
                .onChange(of: isPresented) { presenting in
                    if presenting {
                        launch()
                    } else {
                        finish(onlyIfUnpresented: true)
                    }
                }
                .sheet(isPresented: $isPresented, onDismiss: { finish() }) {
                    FrakSharingSheetContent(presenter: presenter, heightFraction: heightFraction)
                }
        }

        private func launch() {
            presenter.launch(
                // Read, never captured — see `body`.
                presenter.pendingRequest,
                onOutcome: { result in
                    if result.significance > (best?.significance ?? -1) {
                        best = result
                    }
                },
                onClose: { isPresented = false }
            )
        }

        /// The single exit, whether the sheet closed itself or the user swiped it away. `finish`
        /// never calls this closure more than once, and never for a session that had no sheet.
        private func finish(onlyIfUnpresented: Bool = false) {
            presenter.finish(onlyIfUnpresented: onlyIfUnpresented) {
                onResult(best ?? .dismissed)
                best = nil
            }
        }
    }

    private struct FrakSharingSheetContent: View {
        @ObservedObject var presenter: SharingPresenter
        let heightFraction: CGFloat

        var body: some View {
            ZStack {
                if let presentation = presenter.presentation {
                    // Deliberately no `.id(presentation)`: two identities for one *pooled* engine
                    // means SwiftUI tearing the outgoing one down calls `removeFromSuperview` on a
                    // view that by then belongs to the incoming sheet, which goes transparent.
                    PresentedSharingSession(presentation: presentation)
                } else {
                    // Here rather than at this view's root: once a presentation exists,
                    // `PresentedSharingSession` picks between this and `SheetBackground(clear:
                    // false)` for `contentLost`, and only it observes the model that decides.
                    SharingSheetSkeleton()
                        .modifier(SheetBackground(clear: true))
                }

                SharingSheetGrabStrip()
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            // Full bleed: the page insets its own footer from `env(safe-area-inset-bottom)`, so
            // honouring the safe area here shows the sheet through as a band under the CTA.
            .ignoresSafeArea()
            // The sheet is what `heightFraction` resizes, not the content inside it: a `.sheet`
            // with no detents is presented at `.large` whatever the content does.
            .modifier(SharingSheetChrome(fraction: clampedSharingHeightFraction(heightFraction)))
            // Deliberately does not launch: from here the sheet owns teardown, not the
            // `isPresented` change, and SwiftUI can fire this again behind a dismissal.
            .onAppear { presenter.onPresented() }
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
                SharingWebViewContainer(
                    webView: presentation.webView,
                    onDismantled: { [presentation] in presentation.onContentDismantled() }
                )

                if !model.pageVisible {
                    SharingSheetSkeleton()
                        .transition(.opacity)
                }

                if model.contentLost {
                    // A renderer crash after the page painted: the (deliberately transparent —
                    // see `SharingWebView.isOpaque`) web view now composites nothing. Not the
                    // skeleton above, which pulses as though still loading, and not an error
                    // screen: a dead renderer has nothing left to retry. Just a real surface
                    // behind a sheet the user can still swipe away.
                    ContentLostSurface()
                }
            }
            .animation(.easeInOut(duration: Self.fadeDuration), value: model.pageVisible)
            // Without this the system sheet background shows as a seam wherever the page
            // doesn't reach — except once `contentLost`, when the page isn't reaching anywhere
            // and a transparent sheet would be a hole straight through to whatever is behind it.
            // iOS 16.4+ only.
            .modifier(SheetBackground(clear: !model.contentLost))
            // A finished document that produced no paint signal is uncovered on a short grace.
            // There is deliberately no timer for the unfinished case: the web view is transparent,
            // so lifting the skeleton off a page that has not painted shows a hole rather than a
            // page. A document that never arrives is ended by the load deadline, not uncovered.
            .task(id: model.pageLoaded) {
                guard model.pageLoaded else { return }
                try? await Task.sleep(nanoseconds: UInt64(Self.skeletonGrace * 1_000_000_000))
                guard !Task.isCancelled else { return }
                model.onPageVisible()
            }
        }

        private static let fadeDuration = 0.18
        /// Longest the skeleton may cover a finished document that produced no paint signal.
        private static let skeletonGrace: TimeInterval = 0.4
    }

    /// Clears the sheet's own background where the OS allows it, or leaves the system default in
    /// place. A modifier rather than an inline `if #available`: the two branches return different
    /// opaque types. `clear` is false only for `SharingSheetModel.contentLost` — see
    /// `ContentLostSurface`.
    private struct SheetBackground: ViewModifier {
        let clear: Bool
        func body(content: Content) -> some View {
            if #available(iOS 16.4, *), clear {
                content.presentationBackground(.clear)
            } else {
                content
            }
        }
    }

    /// Sizes the sheet to `fraction` of the height available to it and shows the grabber. A
    /// modifier rather than an inline `if #available`, for the same reason as `SheetBackground`.
    ///
    /// `.fraction` measures against the largest detent, so it already accounts for the sheet's
    /// top inset and for Slide Over/Split View on iPad. iOS 15 has no detents, so there the
    /// content is what shrinks.
    private struct SharingSheetChrome: ViewModifier {
        let fraction: CGFloat
        func body(content: Content) -> some View {
            if #available(iOS 16.0, *) {
                content
                    .presentationDetents([.fraction(fraction)])
                    .presentationDragIndicator(.visible)
            } else {
                GeometryReader { proxy in
                    content.frame(height: proxy.size.height * fraction)
                }
            }
        }
    }

    /// The sheet's only drag surface: the page scrolls a child of its own, so WebKit claims
    /// every vertical pan and the sheet's gesture never sees one. Invisible, and stacked over the
    /// web view so that view never sees these touches. Mirrors `SharingSheetGrabStrip` in
    /// `FrakSharingSheet.kt`, height included.
    private struct SharingSheetGrabStrip: View {
        var body: some View {
            Color.clear
                .frame(height: Self.height)
                .contentShape(Rectangle())
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                // The grabber is decoration; the sheet publishes its own dismiss action.
                .accessibilityHidden(true)
        }

        /// Deliberately generous: the visible pill is a few points tall.
        private static let height: CGFloat = 44
    }

    /// What covers the sheet once `SharingSheetModel.contentLost` is set. Matches
    /// `SharingSheetSkeleton`'s own `Color(.systemBackground)` fill rather than inventing a new
    /// treatment — deliberately plain, since this is neither a loading state nor an error one.
    private struct ContentLostSurface: View {
        var body: some View {
            Color(.systemBackground)
        }
    }
#endif
