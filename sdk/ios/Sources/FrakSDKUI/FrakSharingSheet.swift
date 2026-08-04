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
        /// `onResult` is called exactly once per presentation, with the most significant
        /// outcome the session produced: install beats a share or a copy, which beat a
        /// dismissal. Hoist this onto a screen-level view rather than a list row — with
        /// `FrakConfig.preloadSharing` on, one per row means one warm web view per row.
        ///
        /// `heightFraction` is the fraction of *screen* height given to the sheet, defaulting
        /// to `FrakSharingDefaults.heightFraction`. All of it goes to the hosted page — the
        /// title and the Copy/Share footer that used to share it are the page's own now, so
        /// nothing native is left to grow under Dynamic Type and squeeze the page. It is
        /// clamped to `0.3...1.0` before use, so an out-of-range value from the caller cannot
        /// collapse the page to nothing or push the sheet past the screen.
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

        /// The most significant outcome so far. Held here rather than in the sheet so a user
        /// who swipes the sheet away after sharing is still reported as having shared.
        @State private var best: SharingResult?

        func body(content: Content) -> some View {
            content
                .background { WarmSharingWebView() }
                .sheet(
                    isPresented: $isPresented,
                    onDismiss: {
                        // The single exit, whether the sheet closed itself or the user swiped it.
                        onResult(best ?? .dismissed)
                        best = nil
                    }
                ) {
                    FrakSharingSheetContent(
                        request: request,
                        heightFraction: heightFraction,
                        onOutcome: { result in
                            if result.significance > (best?.significance ?? -1) {
                                best = result
                            }
                        },
                        onClose: { isPresented = false }
                    )
                }
        }
    }

    private struct FrakSharingSheetContent: View {
        let request: SharingRequest
        let heightFraction: CGFloat
        let onOutcome: (SharingResult) -> Void
        let onClose: () -> Void

        @StateObject private var model = SharingSheetModel()

        var body: some View {
            // `GeometryReader`, not `UIScreen.main.bounds`: the latter is the physical display
            // and does not shrink for Slide Over/Split View on iPad, so a merchant's
            // `heightFraction` would blow past the app's actual window there. A `.sheet` with
            // no `.presentationDetents` is already sized to (essentially) the full screen on
            // this package's iOS 15 floor, so the space this reader is offered is the same
            // "screen height" `heightFraction` promises, and stays that on iOS 16+ too since
            // no detent is applied here. `.presentationDetents` was evaluated for a tighter
            // sheet, but sizing it correctly needs the page's own idea of its height, which is
            // not knowable from here without a second measurement pass.
            GeometryReader { proxy in
                let sheetHeight = proxy.size.height * clampedSharingHeightFraction(heightFraction)
                ZStack {
                    if let webView = model.webView {
                        SharingWebViewContainer(webView: webView)
                    } else {
                        // The one moment the sheet has no page to show. It paints the system
                        // sheet colour for it, because the sheet's own background is cleared
                        // below and a spinner floating on whatever is behind the sheet would
                        // read as a rendering bug rather than as loading.
                        Color(.systemBackground).overlay(ProgressView())
                    }
                }
                .frame(height: sheetHeight)
                // The page paints the only surface in this sheet — the title bar and the
                // Copy/Share footer that used to sit around it are the page's own now, and the
                // system sheet background behind them showed as a seam wherever the page did
                // not reach. iOS 16.4 is where this became expressible; below it the WebView
                // filling the sheet is what hides the difference, which is most of the way
                // there and the reason this is not worth a `UIViewControllerRepresentable`.
                .modifier(ClearSheetBackground())
            }
            .onAppear {
                // Bound here rather than at construction so they are the current closures,
                // and so the model never has to know what is presenting it.
                model.onOutcome = onOutcome
                model.onClose = onClose
                Task { await model.start(request) }
            }
            .onDisappear { model.release() }
        }
    }

    /// Clears the sheet's own background where the OS allows it.
    ///
    /// A modifier rather than an inline `if #available`: the two branches return different
    /// opaque types, which a `some View` body cannot express without erasing to `AnyView` on
    /// every render.
    private struct ClearSheetBackground: ViewModifier {
        func body(content: Content) -> some View {
            if #available(iOS 16.4, *) {
                content.presentationBackground(.clear)
            } else {
                // Nothing to do below 16.4 and nothing lost that matters: the page fills the
                // sheet, so the system background is only visible behind the corner radius.
                content
            }
        }
    }
#endif
