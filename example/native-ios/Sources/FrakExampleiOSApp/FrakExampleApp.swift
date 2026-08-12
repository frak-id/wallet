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
    let imageURL: String
    let priceCents: Int64
}

/// Configured merchant id, echoed in the debug panel next to the one the backend resolves.
let merchantId = "0a799880-ba54-4276-a734-db8721911bab"

/// Store homepage, used by the unscoped share and as the collection landing page.
let storeLink = "https://example.com"

/// Shared with the Android harness — same ids, titles, links, images.
let sampleProducts = [
    ProductItem(
        id: "prod_001",
        title: "Babies camel cuir velours bout carré",
        link: "https://example.com/product-1",
        imageURL: "https://picsum.photos/seed/frak-prod-001/600/600",
        priceCents: 14999
    ),
    ProductItem(
        id: "prod_002",
        title: "Sneakers blanches classiques",
        link: "https://example.com/product-2",
        imageURL: "https://picsum.photos/seed/frak-prod-002/600/600",
        priceCents: 8990
    ),
    ProductItem(
        id: "prod_003",
        title: "Boots en cuir noir",
        link: "https://example.com/product-3",
        imageURL: "https://picsum.photos/seed/frak-prod-003/600/600",
        priceCents: 21500
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

/// Maps a catalog row onto the SDK's sharing model, images and scope fields included.
func sharingProduct(_ product: ProductItem) -> SharingProduct {
    SharingProduct(
        title: product.title,
        link: product.link,
        imageURL: product.imageURL,
        utmContent: product.id,
        details: ProductDetails(
            productId: product.id,
            name: product.title,
            unitPrice: Double(product.priceCents) / 100
        )
    )
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

/// One label/value line of the SDK debug panel.
struct DebugRow: Identifiable {
    let label: String
    let value: String

    var id: String { label }
}

@main
struct FrakExampleApp: App {
    @State private var selectedTab = 0
    @State private var logs: [LogEntry] = []
    @State private var catalogReward: CatalogRewardLookup = .loading
    @State private var isSharingPresented = false
    @State private var pendingSharingRequest = SharingRequest()
    @State private var debugRows: [DebugRow] = []
    @State private var isDebugRefreshing = false

    init() {
        // .manual is the only DeepLinkHandling option on iOS: inbound URLs are routed to
        // appLink.handleReferral(_:) by hand — see .onOpenURL below.
        Frak.initialize(
            FrakConfig(
                merchantId: merchantId,
                metadata: FrakMetadata(
                    name: "Frak iOS Harness",
                    // Last fallback of the share link chain, so the unscoped share
                    // (no link, no products) still has something to link to.
                    homepageLink: storeLink
                ),
                // Development points at the dev wallet app; isFrakAppInstalled() reports
                // false without it.
                env: .development,
                deepLink: .manual,
                logLevel: .info
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
                        onShareStore: handleShareStore,
                        onShareProduct: handleShareProduct,
                        onShareCollection: handleShareCollection
                    )
                } else {
                    CheckoutToolsView(
                        debugRows: debugRows,
                        isDebugRefreshing: isDebugRefreshing,
                        onSimulateDeepLink: handleSimulateDeepLink,
                        onOrderCompleted: handleOrderCompleted,
                        onRefreshDebugInfo: { Task { await refreshDebugInfo(log: true) } }
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
                    "Frak.initialize called for merchant \(merchantId) (development)",
                    type: .info
                )
                await checkWalletInstalled()
                await resolveConfig()
                await loadCatalogReward()
                await refreshDebugInfo(log: false)
            }
            // .manual is the only mode on iOS, so this call is mandatory.
            .onOpenURL { url in
                handleInboundURL(url)
            }
            // One sheet instance for every entry point, driven by pendingSharingRequest.
            .frakSharingSheet(
                isPresented: $isSharingPresented,
                request: pendingSharingRequest,
                onResult: handleSharingResult
            )
        }
    }

    /// Share #1: no products at all — the link falls back to the merchant homepage.
    private func handleShareStore() {
        addLog("Triggering sharing sheet with no product scope...", type: .info)
        pendingSharingRequest = SharingRequest(
            targetInteraction: "purchase",
            placement: "home"
        )
        isSharingPresented = true
    }

    /// Share #2: exactly one product, scoped and illustrated.
    private func handleShareProduct(_ product: ProductItem) {
        addLog("Triggering sharing sheet for '\(product.title)'...", type: .info)
        pendingSharingRequest = SharingRequest(
            products: [sharingProduct(product)],
            // Matches the rewards.best call below.
            targetInteraction: "purchase",
            placement: "product-page"
        )
        isSharingPresented = true
    }

    /// Share #3: the whole catalog, so the sheet renders several illustrated product cards.
    private func handleShareCollection() {
        addLog("Triggering sharing sheet for \(sampleProducts.count) products...", type: .info)
        pendingSharingRequest = SharingRequest(
            // Products carry their own links, so the shared URL has to be stated: without it the
            // first product's link would win and the recipient would miss the collection.
            link: "\(storeLink)/collections/best-sellers",
            products: sampleProducts.map(sharingProduct),
            targetInteraction: "purchase",
            placement: "category-page"
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

    /// Every wiring fact the SDK can answer for, in one snapshot: the configured merchant id next
    /// to the one the backend resolved, the identity events are attributed to, and the origins the
    /// calls actually go to.
    private func refreshDebugInfo(log: Bool) async {
        isDebugRefreshing = true
        defer { isDebugRefreshing = false }

        var rows = [
            DebugRow(label: "SDK version", value: FrakSDKVersion.current),
            DebugRow(label: "Configured merchant id", value: merchantId),
            DebugRow(label: "Bundle id", value: Bundle.main.bundleIdentifier ?? "unknown"),
        ]

        guard let client = client() else {
            rows.append(DebugRow(label: "Client", value: "not initialized"))
            debugRows = rows
            if log { addLog("SDK debug info: client not initialized.", type: .error) }
            return
        }

        let environment = client.environment
        rows.append(DebugRow(label: "Environment", value: "\(environment)"))
        rows.append(DebugRow(label: "Wallet origin", value: environment.wallet))
        rows.append(DebugRow(label: "Backend origin", value: environment.backend))
        rows.append(DebugRow(label: "Wallet scheme", value: environment.walletScheme))
        rows.append(
            DebugRow(label: "Wallet app installed", value: "\(await client.appLink.isFrakAppInstalled())")
        )
        rows.append(DebugRow(label: "Tracking enabled", value: "\(await client.isTrackingEnabled())"))
        rows.append(
            DebugRow(
                label: "Anonymous id",
                value: await client.anonymousId ?? "none (tracking off or key refused)"
            )
        )

        do {
            let resolved = try await client.config.resolve()
            rows.append(DebugRow(label: "Resolved merchant id", value: resolved.merchantId))
            rows.append(DebugRow(label: "Merchant name", value: resolved.displayName))
            rows.append(DebugRow(label: "Merchant domain", value: resolved.domain))
            rows.append(DebugRow(label: "Currency", value: resolved.currency?.rawValue ?? "unset"))
            rows.append(DebugRow(label: "Language", value: resolved.lang?.rawValue ?? "unset"))
            let placements = resolved.sdkConfig?.placements.keys.sorted() ?? []
            rows.append(
                DebugRow(
                    label: "Configured placements",
                    value: placements.isEmpty ? "none" : placements.joined(separator: ", ")
                )
            )
        } catch {
            rows.append(DebugRow(label: "Resolved config", value: "failed: \(error.localizedDescription)"))
        }

        debugRows = rows
        if log { addLog("SDK debug info refreshed (\(rows.count) fields).", type: .success) }
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
    let onShareStore: () -> Void
    let onShareProduct: (ProductItem) -> Void
    let onShareCollection: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // One headline card for the whole catalog, not one per row.
                CatalogRewardBanner(label: catalogRewardLabel)

                ShareScopeCard(
                    title: "Share the store",
                    subtitle: "No product scope: no products and no link, so the sheet falls back to the homepage.",
                    buttonLabel: "Share Store (no product)",
                    systemImage: "storefront",
                    action: onShareStore
                )

                ShareScopeCard(
                    title: "Share the collection",
                    subtitle:
                        "\(products.count) products, each with an image — the sheet renders one card per product.",
                    buttonLabel: "Share Collection (\(products.count) products)",
                    systemImage: "square.grid.2x2",
                    action: onShareCollection
                )

                ForEach(products) { product in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(product.title)
                            .font(.headline)
                            .foregroundColor(FrakTheme.textPrimary)
                        Text("\(formatCents(product.priceCents)) · \(product.id)")
                            .font(.caption)
                            .foregroundColor(FrakTheme.textSecondary)
                        Button(action: { onShareProduct(product) }) {
                            HStack {
                                Image(systemName: "square.and.arrow.up")
                                Text("Share This Product")
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

/// The store-wide and collection-wide share entry points; product rows have their own button.
struct ShareScopeCard: View {
    let title: String
    let subtitle: String
    let buttonLabel: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .foregroundColor(FrakTheme.textPrimary)
            Text(subtitle)
                .font(.caption)
                .foregroundColor(FrakTheme.textSecondary)
            Button(action: action) {
                HStack {
                    Image(systemName: systemImage)
                    Text(buttonLabel)
                }
                .frame(maxWidth: .infinity)
                .padding(8)
                .background(FrakTheme.surfacePrimary)
                .foregroundColor(FrakTheme.textOnAction)
                .cornerRadius(8)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(FrakTheme.surfaceBackground2)
        .cornerRadius(10)
    }
}

struct CheckoutToolsView: View {
    let debugRows: [DebugRow]
    let isDebugRefreshing: Bool
    let onSimulateDeepLink: () -> Void
    let onOrderCompleted: () -> Void
    let onRefreshDebugInfo: () -> Void

    var body: some View {
        ScrollView {
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

                SdkDebugCard(
                    rows: debugRows,
                    isRefreshing: isDebugRefreshing,
                    onRefresh: onRefreshDebugInfo
                )
            }
        }
    }
}

/// Everything the SDK reports about this install, for checking the wiring on a real device.
struct SdkDebugCard: View {
    let rows: [DebugRow]
    let isRefreshing: Bool
    let onRefresh: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("SDK Debug Info")
                .font(.headline)
                .foregroundColor(FrakTheme.textPrimary)
            Text("Read back from the live client — identity, merchant and origins.")
                .font(.caption)
                .foregroundColor(FrakTheme.textSecondary)

            if rows.isEmpty {
                Text("Loading…")
                    .font(.caption)
                    .foregroundColor(FrakTheme.textSecondary)
            }
            ForEach(rows) { row in
                HStack(alignment: .top, spacing: 4) {
                    Text("\(row.label):")
                        .foregroundColor(FrakTheme.textSecondary)
                    Text(row.value)
                        .foregroundColor(FrakTheme.textPrimary)
                        .textSelection(.enabled)
                }
                .font(.system(size: 11, design: .monospaced))
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button(action: onRefresh) {
                HStack {
                    Image(systemName: "arrow.clockwise")
                    Text(isRefreshing ? "Refreshing…" : "Refresh SDK Info")
                }
                .frame(maxWidth: .infinity)
                .padding(10)
                .background(FrakTheme.surfacePrimary)
                .foregroundColor(FrakTheme.textOnAction)
                .cornerRadius(8)
            }
            .disabled(isRefreshing)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(FrakTheme.surfaceBackground2)
        .cornerRadius(10)
    }
}
