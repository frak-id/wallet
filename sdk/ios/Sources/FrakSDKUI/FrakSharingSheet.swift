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
        /// `heightFraction` is the fraction of *screen* height given to the sheet as a whole —
        /// title, hosted page and Copy/Share footer together — defaulting to
        /// `FrakSharingDefaults.heightFraction`. The hosted page takes whatever is left after the
        /// title and footer, so chrome growth (Dynamic Type, a longer localized title) eats into
        /// the page rather than pushing the sheet past the screen. It is clamped to `0.3...1.0`
        /// before use, so an out-of-range value from the caller cannot collapse the page to
        /// nothing or push the sheet past the screen.
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
            // sheet, but sizing it correctly needs the *chrome's* height (title + footer),
            // which is not knowable without either a hard-coded estimate — wrong under Dynamic
            // Type or localization — or a second measurement pass; the page box below is the
            // part this fix owns, and it is what was clipping content.
            GeometryReader { proxy in
                let sheetHeight = proxy.size.height * clampedSharingHeightFraction(heightFraction)
                VStack(spacing: 0) {
                    Text("frak.sharing.title", bundle: .module)
                        .font(.headline)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)

                    ZStack {
                        if let webView = model.webView {
                            SharingWebViewContainer(webView: webView)
                        } else {
                            ProgressView()
                        }
                    }
                    .frame(maxHeight: .infinity)

                    if model.copyConfirmed {
                        Text("frak.sharing.copied", bundle: .module)
                            .font(.footnote)
                            .foregroundColor(.secondary)
                            .padding(.top, 8)
                    }

                    // Hidden on the install page: both act on the product link and reload
                    // `/sharing`, which would discard the install page and the proof minted for it.
                    // Hidden on the confirmation screen for a different reason: the user has
                    // already shared, the page now offers its own "share again"/install controls,
                    // and a live Copy/Share under them reads as though the share had not registered.
                    if !model.showingInstallPage && !model.showingConfirmation {
                        HStack(spacing: 12) {
                            Button {
                                Task { await model.copy() }
                            } label: {
                                Text("frak.sharing.copy", bundle: .module).frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)

                            Button {
                                Task { await model.share() }
                            } label: {
                                Text("frak.sharing.share", bundle: .module).frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                        }
                        .disabled(model.webView == nil)
                        .padding(16)
                    }
                }
                .frame(height: sheetHeight)
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
#endif
