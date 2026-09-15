import SwiftUI

/// The shopper-facing surface: what a merchant's own catalog screen would look like, with the
/// three sharing entry points a merchant can wire.
struct ShopTab: View {
    let products: [ProductItem]
    let catalogRewardLabel: String
    let currencyCode: String
    let onShareStore: () -> Void
    let onShareProduct: (ProductItem) -> Void
    let onShareCollection: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                HarnessCard(
                    title: "Reward for sharing",
                    subtitle: "One lookup covers the whole catalog.",
                    tinted: true
                ) {
                    Text(catalogRewardLabel)
                        .font(.title3)
                        .bold()
                        .foregroundColor(FrakTheme.textAction)
                }

                HarnessCard(
                    title: "Share the whole store",
                    subtitle: "No product attached — the link points at the store homepage."
                ) {
                    ActionButton(
                        label: "Share the store",
                        systemImage: "storefront",
                        action: onShareStore
                    )
                }

                HarnessCard(
                    title: "Share the Best Sellers collection",
                    subtitle: "\(products.count) products in one link, each with its own image."
                ) {
                    ActionButton(
                        label: "Share \(products.count) products",
                        systemImage: "square.grid.2x2",
                        action: onShareCollection
                    )
                }

                ForEach(products) { product in
                    ProductRow(
                        product: product,
                        currencyCode: currencyCode,
                        onShare: onShareProduct
                    )
                }
            }
        }
    }
}

private struct ProductRow: View {
    let product: ProductItem
    let currencyCode: String
    let onShare: (ProductItem) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                ProductThumbnail(url: product.imageURL)
                VStack(alignment: .leading, spacing: 4) {
                    Text(product.title)
                        .font(.headline)
                        .foregroundColor(FrakTheme.textPrimary)
                    Text(formatCents(product.priceCents, currencyCode: currencyCode))
                        .font(.subheadline)
                        .foregroundColor(FrakTheme.textPrimary)
                    Text(product.id)
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundColor(FrakTheme.textSecondary)
                }
                Spacer(minLength: 0)
            }
            ActionButton(
                label: "Share this product",
                systemImage: "square.and.arrow.up"
            ) {
                onShare(product)
            }
        }
        .padding(12)
        .background(FrakTheme.surfaceBackground2)
        .cornerRadius(10)
    }
}

/// The image the SDK is handed for this row, rendered so a tester can compare it against what the
/// sharing sheet draws.
private struct ProductThumbnail: View {
    let url: String

    var body: some View {
        AsyncImage(url: URL(string: url)) { image in
            image
                .resizable()
                .aspectRatio(contentMode: .fill)
        } placeholder: {
            FrakTheme.surfaceMuted
        }
        .frame(width: 72, height: 72)
        .clipped()
        .cornerRadius(8)
    }
}
