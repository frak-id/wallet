#if canImport(UIKit)
    import SwiftUI

    /// What the sheet shows until the hosted page has actually painted.
    ///
    /// A silhouette rather than a spinner, and opaque rather than translucent, because it is
    /// stacked *over* the web view for the whole load: a `WKWebView` paints its background before
    /// it has content, and the old spinner-then-swap sequence showed that empty rectangle for the
    /// entire page load. Nothing here is measured against the real page — a rough shape that
    /// fades out reads as content arriving, where an exact one that lands a few pixels off reads
    /// as a jump.
    ///
    /// Mirrors `SharingSheetSkeleton.kt`; the two are deliberately the same silhouette, since a
    /// merchant shipping both platforms sees them side by side.
    struct SharingSheetSkeleton: View {
        @State private var pulsing = false

        var body: some View {
            ZStack {
                // The system sheet colour, opaque: this is covering a web view, not floating over
                // the merchant's screen.
                Color(.systemBackground)

                VStack(alignment: .leading, spacing: 16) {
                    // Merchant row: logo, name.
                    HStack(spacing: 12) {
                        Block(width: 28, height: 28, cornerRadius: 14)
                        Block(height: 28)
                            .frame(maxWidth: 160)
                        Spacer(minLength: 0)
                    }

                    // The reward headline, the page's largest element.
                    Block(height: 92, cornerRadius: 16)

                    // Product cards.
                    HStack(spacing: 12) {
                        Block(height: 108, cornerRadius: 12)
                        Block(height: 108, cornerRadius: 12)
                    }

                    // The three-step explainer.
                    ForEach(0..<Self.stepCount, id: \.self) { _ in
                        HStack(spacing: 12) {
                            Block(width: 20, height: 20, cornerRadius: 10)
                            Block(height: 20)
                        }
                    }

                    Spacer(minLength: 0)

                    // Share / Copy footer.
                    Block(height: 48, cornerRadius: 24)
                }
                // Top inset clears the sheet's own grabber, which is drawn over this.
                .padding(EdgeInsets(top: 36, leading: 20, bottom: 20, trailing: 20))
                .opacity(pulsing ? Self.maxOpacity : Self.minOpacity)
                .animation(
                    .easeInOut(duration: Self.pulseDuration).repeatForever(autoreverses: true),
                    value: pulsing
                )
            }
            // Started from `onAppear` rather than an initial value: an animation attached to a
            // state that never changes never runs.
            .onAppear { pulsing = true }
            // Purely decorative, and stacked over a live web view — VoiceOver should read the
            // page underneath, not this.
            .accessibilityHidden(true)
        }

        private static let minOpacity = 0.45
        private static let maxOpacity = 0.85
        private static let pulseDuration = 0.7
        private static let stepCount = 3
    }

    /// One grey bar. `width` nil means "take what the row gives me".
    private struct Block: View {
        var width: CGFloat?
        let height: CGFloat
        var cornerRadius: CGFloat = 8

        var body: some View {
            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                .fill(Color(.secondarySystemBackground))
                .frame(width: width, height: height)
        }
    }
#endif
