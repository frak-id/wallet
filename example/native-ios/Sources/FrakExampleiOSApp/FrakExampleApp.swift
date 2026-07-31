import SwiftUI

struct LogEntry: Identifiable {
    let id = UUID()
    let timestamp: String
    let message: String
    let type: LogType

    enum LogType {
        case info, success, error
    }
}

/// Shared with the Android harness — same ids, titles and reward amounts, so a
/// divergence between the two apps is visible in review.
let sampleProducts = [
    ProductItem(
        id: "prod_001",
        title: "Babies camel cuir velours bout carré",
        link: "https://example.com/product-1",
        estimatedRewardCents: 1500
    ),
    ProductItem(
        id: "prod_002",
        title: "Sneakers blanches classiques",
        link: "https://example.com/product-2",
        estimatedRewardCents: 1250
    ),
    ProductItem(
        id: "prod_003",
        title: "Boots en cuir noir",
        link: "https://example.com/product-3",
        estimatedRewardCents: 2000
    ),
]

/// Order total used by the checkout simulator, shared with the Android harness.
let sampleOrderTotalCents: Int64 = 14999

/// Hoisted: `DateFormatter` is expensive to build and this runs per log line.
let logTimeFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateFormat = "HH:mm:ss"
    return formatter
}()

/// Display-only formatting, local to the harness.
///
/// The real SDK formats rewards server-side; this exists so the two example apps
/// render identical strings and a divergence shows up in review. Deliberately
/// not `NumberFormatter`: Android and iOS emit different output for identical
/// locale and currency input (`"CHF 10.00"` vs `"CHF10.00"`).
func formatCents(_ cents: Int64) -> String {
    String(format: "$%lld.%02lld", cents / 100, cents % 100)
}

@main
struct FrakExampleApp: App {
    @State private var selectedTab = 0
    @State private var logs: [LogEntry] = []

    init() {
        FrakClient.shared.initialize(
            config: FrakConfig(
                merchantId: "merchant_example_ios_123",
                deepLink: .automatic
            )
        )
    }

    var body: some Scene {
        WindowGroup {
            VStack(spacing: 12) {
                Text("Frak Merchant iOS Harness")
                    .font(.title2)
                    .bold()
                    .foregroundColor(FrakTheme.textPrimary)

                Text("No SDK is wired up — every call below logs and returns.")
                    .font(.caption)
                    .foregroundColor(FrakTheme.textPrimary)
                    .padding(8)
                    .frame(maxWidth: .infinity)
                    .background(FrakTheme.surfaceSecondary)
                    .cornerRadius(8)

                Picker("View", selection: $selectedTab) {
                    Text("Product Catalog").tag(0)
                    Text("Checkout & Tools").tag(1)
                }
                .pickerStyle(SegmentedPickerStyle())

                if selectedTab == 0 {
                    ProductCatalogView(products: sampleProducts, onShareProduct: handleShareProduct)
                } else {
                    CheckoutToolsView(
                        onSimulateDeepLink: handleSimulateDeepLink,
                        onOrderCompleted: handleOrderCompleted
                    )
                }

                // Event Log View
                VStack(alignment: .leading, spacing: 4) {
                    Text("SDK Event Log:")
                        .font(.caption)
                        .bold()
                        .foregroundColor(FrakTheme.textPrimary)

                    ScrollView {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(logs) { entry in
                                HStack(alignment: .top, spacing: 4) {
                                    Text("[\(entry.timestamp)]")
                                        .foregroundColor(FrakTheme.consoleTimestamp)
                                    Text(entry.message)
                                        .foregroundColor(colorForType(entry.type))
                                }
                                .font(.system(size: 11, design: .monospaced))
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(8)
                    }
                    .frame(height: 120)
                    .background(FrakTheme.consoleSurface)
                    .cornerRadius(8)
                }
            }
            .padding()
            .onAppear {
                addLog("SDK initialized for merchant_example_ios_123", type: .info)
            }
            // `CFBundleURLTypes` registration and this delivery path are the
            // real thing and are what this exercises. The URL itself is only
            // logged — parsing `fCtx` is the SDK's job and there is no SDK.
            .onOpenURL { url in
                FrakClient.shared.handleReferralLink(url)
                addLog("Inbound URL reached the app: \(url)", type: .success)
            }
        }
    }

    private func handleShareProduct(_ product: ProductItem) {
        addLog("Triggering sharing page for '\(product.title)'...", type: .info)
        let request = SharingRequest(
            productId: product.id,
            productName: product.title,
            estimatedRewardCents: product.estimatedRewardCents,
            products: [product]
        )
        FrakClient.shared.presentSharing(request: request) { result in
            switch result {
            case .shared:
                addLog("Reward link shared successfully!", type: .success)
            case .copied:
                addLog("Reward link copied to clipboard!", type: .success)
            case .installed:
                addLog("Wallet install flow triggered!", type: .info)
            case .dismissed:
                addLog("Sharing sheet dismissed by user.", type: .info)
            case .failed(let error):
                addLog("Sharing failed: \(error)", type: .error)
            }
        }
    }

    private func handleSimulateDeepLink() {
        guard let url = URL(string: "https://example-merchant.com/product?fCtx=test_referral_token_ios_8877") else {
            return
        }
        FrakClient.shared.handleReferralLink(url)
        addLog("Simulated inbound URL: \(url)", type: .info)
    }

    private func handleOrderCompleted() {
        let orderId = "ord_\(Int(Date().timeIntervalSince1970))"
        let purchase = PurchaseDetails(
            orderId: orderId,
            amountInCents: sampleOrderTotalCents
        )
        FrakClient.shared.trackPurchase(purchase)
        addLog(
            "Order \(orderId) (\(formatCents(sampleOrderTotalCents))) handed to the SDK — not tracked, no SDK",
            type: .info
        )
    }

    private func addLog(_ message: String, type: LogEntry.LogType) {
        let timestamp = logTimeFormatter.string(from: Date())
        logs.insert(LogEntry(timestamp: timestamp, message: message, type: type), at: 0)
    }

    private func colorForType(_ type: LogEntry.LogType) -> Color {
        switch type {
        case .info: return FrakTheme.consoleInfo
        case .success: return FrakTheme.consoleSuccess
        case .error: return FrakTheme.consoleError
        }
    }
}

struct ProductCatalogView: View {
    let products: [ProductItem]
    let onShareProduct: (ProductItem) -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                ForEach(products) { product in
                    let reward = formatCents(product.estimatedRewardCents)
                    VStack(alignment: .leading, spacing: 8) {
                        Text(product.title)
                            .font(.headline)
                            .foregroundColor(FrakTheme.textPrimary)
                        Text("Estimated Reward: \(reward)")
                            .font(.caption)
                            .foregroundColor(FrakTheme.textAction)
                        Button(action: { onShareProduct(product) }) {
                            HStack {
                                Image(systemName: "square.and.arrow.up")
                                Text("Share & Earn \(reward)")
                            }
                            .frame(maxWidth: .infinity)
                            .padding(8)
                            .background(FrakTheme.surfacePrimary)
                            .foregroundColor(FrakTheme.textOnAction)
                            .cornerRadius(8)
                        }
                    }
                    .padding(12)
                    .background(FrakTheme.surfaceBackground2)
                    .cornerRadius(10)
                }
            }
        }
    }
}

struct CheckoutToolsView: View {
    let onSimulateDeepLink: () -> Void
    let onOrderCompleted: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Order Confirmation Test")
                    .font(.headline)
                    .foregroundColor(FrakTheme.textPrimary)
                Text("Simulate completing a purchase order (#ORD-98231, \(formatCents(sampleOrderTotalCents)))")
                    .font(.caption)
                    .foregroundColor(FrakTheme.textSecondary)
                Button(action: onOrderCompleted) {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                        Text("Complete Order & Track Purchase")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(10)
                    .background(FrakTheme.success)
                    .foregroundColor(FrakTheme.textOnAction)
                    .cornerRadius(8)
                }
            }
            .padding(12)
            .background(FrakTheme.surfaceBackground2)
            .cornerRadius(10)

            VStack(alignment: .leading, spacing: 8) {
                Text("Referral Deep Link Simulator")
                    .font(.headline)
                    .foregroundColor(FrakTheme.textPrimary)
                Text("Simulate user opening app from an inbound referral link with fCtx")
                    .font(.caption)
                    .foregroundColor(FrakTheme.textSecondary)
                Button(action: onSimulateDeepLink) {
                    HStack {
                        Image(systemName: "link")
                        Text("Simulate Inbound fCtx Link")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(10)
                    .background(FrakTheme.surfacePrimary)
                    .foregroundColor(FrakTheme.textOnAction)
                    .cornerRadius(8)
                }
            }
            .padding(12)
            .background(FrakTheme.surfaceBackground2)
            .cornerRadius(10)

            Spacer()
        }
    }
}
