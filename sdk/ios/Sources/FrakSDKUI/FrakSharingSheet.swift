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

        /// The most significant outcome so far, so a user who swipes the sheet away after
        /// sharing is still reported as having shared.
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
            // and does not shrink for Slide Over/Split View on iPad. `.presentationDetents` was
            // evaluated for a tighter sheet but needs the page's own height, not knowable from
            // here without a second measurement pass.
            GeometryReader { proxy in
                let sheetHeight = proxy.size.height * clampedSharingHeightFraction(heightFraction)
                ZStack {
                    if let webView = model.webView {
                        SharingWebViewContainer(webView: webView)
                    } else {
                        // Paints the system sheet colour: the sheet's own background is cleared
                        // below, and a spinner floating on whatever is behind it would read as a
                        // rendering bug.
                        Color(.systemBackground).overlay(ProgressView())
                    }
                }
                .frame(height: sheetHeight)
                // The page paints the only surface in this sheet; without this the system sheet
                // background shows as a seam wherever the page doesn't reach. iOS 16.4+ only —
                // below it the WebView filling the sheet hides the difference.
                .modifier(ClearSheetBackground())
            }
            .onAppear {
                // Bound here, not at construction, so the model never has to know what is presenting it.
                model.onOutcome = onOutcome
                model.onClose = onClose
                Task { await model.start(request) }
            }
            .onDisappear { model.release() }
        }
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
