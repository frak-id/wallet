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
        public func frakSharingSheet(
            isPresented: Binding<Bool>,
            request: SharingRequest,
            onResult: @escaping (SharingResult) -> Void = { _ in }
        ) -> some View {
            modifier(FrakSharingSheetModifier(isPresented: isPresented, request: request, onResult: onResult))
        }
    }

    private struct FrakSharingSheetModifier: ViewModifier {
        @Binding var isPresented: Bool
        let request: SharingRequest
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
        private static let pageHeight: CGFloat = 480

        let request: SharingRequest
        let onOutcome: (SharingResult) -> Void
        let onClose: () -> Void

        @StateObject private var model = SharingSheetModel()

        var body: some View {
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
                .frame(height: Self.pageHeight)

                if model.copyConfirmed {
                    Text("frak.sharing.copied", bundle: .module)
                        .font(.footnote)
                        .foregroundColor(.secondary)
                        .padding(.top, 8)
                }

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
