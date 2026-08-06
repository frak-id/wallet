import FrakSDK
import FrakSDKUI
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

/// Catalog row display model, local to this harness.
struct ProductItem: Identifiable, Sendable {
    let id: String
    let title: String
    let link: String
}

/// Shared with the Android harness — same ids, titles, links.
let sampleProducts = [
    ProductItem(
        id: "prod_001",
        title: "Babies camel cuir velours bout carré",
        link: "https://example.com/product-1"
    ),
    ProductItem(
        id: "prod_002",
        title: "Sneakers blanches classiques",
        link: "https://example.com/product-2"
    ),
    ProductItem(
        id: "prod_003",
        title: "Boots en cuir noir",
        link: "https://example.com/product-3"
    ),
]

/// Order total used by the checkout simulator. Display-only: `tracking.purchase` takes no amount.
let sampleOrderTotalCents: Int64 = 14999

/// `tracking.purchase` needs a customer id and checkout token; both are fabricated for the demo.
let sampleCustomerId = "cust_example_ios_001"
let sampleCheckoutToken = "checkout_token_example_9988"

/// Hoisted: `DateFormatter` is expensive to build and this runs per log line.
let logTimeFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateFormat = "HH:mm:ss"
    return formatter
}()

/// Formats the order total only; reward amounts come from `BestReward.formatted`.
func formatCents(_ cents: Int64) -> String {
    String(format: "$%lld.%02lld", cents / 100, cents % 100)
}

/// State of the catalog-wide rewards.best lookup.
private enum CatalogRewardLookup {
    case loading
    case loaded(BestReward)
    case noActiveReward
    case failed

    var label: String {
        switch self {
        case .loading: return "Checking catalog reward…"
        case .loaded(let reward): return reward.formatted
        case .noActiveReward: return "No active reward"
        case .failed: return "Reward unavailable (placeholder)"
        }
    }
}

@main
struct FrakExampleApp: App {
    @State private var selectedTab = 0
    @State private var logs: [LogEntry] = []
    @State private var catalogReward: CatalogRewardLookup = .loading
    @State private var isSharingPresented = false
    @State private var pendingSharingRequest = SharingRequest()

    init() {
        // .manual is the only DeepLinkHandling option on iOS: inbound URLs are routed to
        // appLink.handleReferral(_:) by hand — see .onOpenURL below.
        Frak.initialize(
            FrakConfig(
                merchantId: "0a799880-ba54-4276-a734-db8721911bab",
                metadata: FrakMetadata(name: "Frak iOS Harness"),
                // Development points at the dev wallet app; isFrakAppInstalled() reports
                // false without it.
                env: .development,
                deepLink: .manual,
                logLevel: .info,
                // Boots the sharing web view up front, so the sheet does not pay for engine
                // startup at tap time.
                preloadSharing: true
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

                Text(
                    "Live Frak SDK against the Frak development backend, using a real merchant id — network calls are expected to succeed."
                )
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
                    ProductCatalogView(
                        products: sampleProducts,
                        catalogRewardLabel: catalogReward.label,
                        onShareProduct: handleShareProduct
                    )
                } else {
                    CheckoutToolsView(
                        onSimulateDeepLink: handleSimulateDeepLink,
                        onOrderCompleted: handleOrderCompleted
                    )
                }

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
            .task {
                addLog(
                    "Frak.initialize called for merchant 0a799880-ba54-4276-a734-db8721911bab (development)",
                    type: .info
                )
                await checkWalletInstalled()
                await resolveConfig()
                await loadCatalogReward()
            }
            // .manual is the only mode on iOS, so this call is mandatory.
            .onOpenURL { url in
                handleInboundURL(url)
            }
            // One sheet instance for every row, driven by pendingSharingRequest.
            .frakSharingSheet(
                isPresented: $isSharingPresented,
                request: pendingSharingRequest,
                onResult: handleSharingResult
            )
        }
    }

    private func handleShareProduct(_ product: ProductItem) {
        addLog("Triggering sharing sheet for '\(product.title)'...", type: .info)
        pendingSharingRequest = SharingRequest(
            products: [SharingProduct(title: product.title, link: product.link)],
            // Matches the rewards.best call below.
            targetInteraction: "purchase",
            placement: "product-page"
        )
        isSharingPresented = true
    }

    private func handleSharingResult(_ result: SharingResult) {
        switch result {
        case .shared(let link):
            addLog("Reward link shared: \(link)", type: .success)
        case .copied(let link):
            addLog("Reward link copied to clipboard: \(link)", type: .success)
        case .installStarted:
            addLog("Wallet install flow started by the sharing sheet.", type: .info)
        case .dismissed:
            addLog("Sharing sheet dismissed by user.", type: .info)
        case .failed(let error):
            addLog("Sharing failed: \(error.localizedDescription)", type: .error)
        }
    }

    /// Both the deep-link simulator button and `.onOpenURL` delivery funnel through here.
    private func handleInboundURL(_ url: URL) {
        addLog("Inbound URL reached the app: \(url)", type: .info)
        Task {
            do {
                let client = try Frak.client
                let hadReferral = await client.appLink.handleReferral(url)
                addLog(
                    hadReferral
                        ? "Referral context recognized and tracked."
                        : "URL carried no Frak referral context.",
                    type: hadReferral ? .success : .info
                )
            } catch {
                addLog("Frak.client unavailable: \(error.localizedDescription)", type: .error)
            }
        }
    }

    private func handleSimulateDeepLink() {
        guard let url = URL(string: "https://example-merchant.com/product?fCtx=test_referral_token_ios_9988") else {
            return
        }
        addLog("Simulating inbound referral link: \(url)", type: .info)
        handleInboundURL(url)
    }

    private func handleOrderCompleted() {
        let orderId = "ord_\(Int(Date().timeIntervalSince1970))"
        addLog("Completing order \(orderId) (\(formatCents(sampleOrderTotalCents)))...", type: .info)
        Task {
            // tracking.purchase has no amount parameter; the total above is display-only.
            let result = await client()?.tracking.purchase(
                customerId: sampleCustomerId,
                orderId: orderId,
                token: sampleCheckoutToken
            )
            switch result {
            case .success:
                addLog("Order \(orderId) tracked successfully.", type: .success)
            case .failure(let error):
                addLog(
                    "Order \(orderId) tracking failed: \(error.localizedDescription)",
                    type: .error
                )
            case nil:
                addLog("Frak.client unavailable — order \(orderId) not tracked.", type: .error)
            }
        }
    }

    private func checkWalletInstalled() async {
        guard let client = client() else {
            addLog("Frak.client unavailable — skipping wallet-installed check.", type: .error)
            return
        }
        let installed = await client.appLink.isFrakAppInstalled()
        addLog("Frak wallet app installed: \(installed)", type: .info)
    }

    private func resolveConfig() async {
        guard let client = client() else {
            addLog("Frak.client unavailable — skipping config resolve.", type: .error)
            return
        }
        do {
            let resolved = try await client.config.resolve()
            addLog("Merchant config resolved: \(resolved.name) (\(resolved.domain))", type: .success)
        } catch {
            addLog("Config resolve failed: \(error.localizedDescription)", type: .error)
        }
    }

    /// One `rewards.best(...)` call for the whole visible catalog, not one per product.
    private func loadCatalogReward() async {
        guard let client = client() else {
            addLog("Frak.client unavailable — skipping reward lookup.", type: .error)
            catalogReward = .failed
            return
        }
        do {
            let best = try await client.rewards.best(
                // Matches SharingRequest.targetInteraction used by handleShareProduct.
                targetInteraction: "purchase",
                products: sampleProducts.map { ProductDetails(productId: $0.id, name: $0.title) }
            )
            if let best {
                catalogReward = .loaded(best)
                addLog("Catalog reward: \(best.formatted)", type: .success)
            } else {
                catalogReward = .noActiveReward
                addLog("No campaign matched the catalog.", type: .info)
            }
        } catch {
            addLog(
                "Catalog reward lookup failed: \(error.localizedDescription)",
                type: .error
            )
            catalogReward = .failed
        }
    }

    /// Adapts `Frak.client`'s throw to a plain optional, in one place.
    private func client() -> FrakClient? {
        try? Frak.client
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
    let catalogRewardLabel: String
    let onShareProduct: (ProductItem) -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // One headline card for the whole catalog, not one per row.
                CatalogRewardBanner(label: catalogRewardLabel)
                ForEach(products) { product in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(product.title)
                            .font(.headline)
                            .foregroundColor(FrakTheme.textPrimary)
                        Button(action: { onShareProduct(product) }) {
                            HStack {
                                Image(systemName: "square.and.arrow.up")
                                Text("Share Product")
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

/// The single headline reward figure for the entire visible catalog.
struct CatalogRewardBanner: View {
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Catalog Reward")
                .font(.caption)
                .foregroundColor(FrakTheme.textPrimary)
            Text(label)
                .font(.headline)
                .foregroundColor(FrakTheme.textAction)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(FrakTheme.surfaceSecondary)
        .cornerRadius(10)
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
