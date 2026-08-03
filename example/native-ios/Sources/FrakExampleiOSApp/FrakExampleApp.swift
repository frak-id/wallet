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

/// Display-only product model, local to this harness — the real SDK has no notion of a
/// catalog. Mapped to `SharingProduct` at the sharing/rewards call sites rather than
/// carrying SDK types directly, so this file stays the merchant's own data shape.
struct ProductItem: Identifiable, Sendable {
    let id: String
    let title: String
    let link: String
}

/// Shared with the Android harness — same ids, titles and links, so a divergence between
/// the two apps is visible in review. Reward amounts are **not** hardcoded here: they come
/// from a single, catalog-wide `rewards.best(...)` call (see `loadCatalogReward()`), so
/// they legitimately differ from Android's numbers.
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

/// Order total used by the checkout simulator, shared with the Android harness. Display
/// only now: `tracking.purchase(customerId:orderId:token:)` has no amount parameter, so
/// this never reaches the SDK — it only labels the button and the log line.
let sampleOrderTotalCents: Int64 = 14999

/// The real SDK has no anonymous-checkout concept — `tracking.purchase` takes a merchant-owned
/// customer id and a checkout token the merchant's own backend would issue. Both are fabricated
/// here; a real integration wires these to its actual customer/checkout records.
let sampleCustomerId = "cust_example_ios_001"
let sampleCheckoutToken = "checkout_token_example_9988"

/// Hoisted: `DateFormatter` is expensive to build and this runs per log line.
let logTimeFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateFormat = "HH:mm:ss"
    return formatter
}()

/// Display-only formatting, local to the harness.
///
/// The real SDK formats rewards server-side (`BestReward.formatted`); this is only used
/// for the merchant's own order-total display, which the SDK has no opinion on.
func formatCents(_ cents: Int64) -> String {
    String(format: "$%lld.%02lld", cents / 100, cents % 100)
}

/// Where the catalog-wide `rewards.best(...)` lookup currently stands, populated by
/// `loadCatalogReward()`. See [ProductCatalogView].
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
        // Clearly-labelled placeholder, not a fabricated amount: the task this harness
        // exists for is proving the real call was made, not showing a pretty number.
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
        // `Frak.initialize` is synchronous and non-throwing (unlike `Frak.client` below) —
        // it only stores config and spins up local state, no I/O.
        //
        // `deepLink: .manual` is the ONLY usable option here: iOS's `DeepLinkHandling` has
        // just `.manual` and `.disabled` — there is no `.automatic`. Android gets a third
        // case because `ActivityLifecycleCallbacks` gives it an app-wide hook to intercept
        // every incoming Intent; iOS has no equivalent hook outside SwiftUI's own
        // `.onOpenURL`/`UIApplicationDelegate`, so the SDK cannot install itself in front of
        // the merchant's own URL routing the way it can on Android. Concretely: the stub
        // this replaced passed `.automatic`, which does not exist on this platform, and
        // every inbound URL must be routed to `appLink.handleReferral(_:)` by hand — see
        // `.onOpenURL` below and `handleInboundURL(_:)`.
        Frak.initialize(
            FrakConfig(
                merchantId: "0a799880-ba54-4276-a734-db8721911bab",
                metadata: FrakMetadata(name: "Frak iOS Harness"),
                // Points at wallet-dev.frak.id / backend.gcp-dev.frak.id and expects the DEV
                // wallet app (`id.frak.wallet.dev`, scheme `frakwallet-dev`) rather than the
                // production one — which is why `appLink.isFrakAppInstalled()` reports false
                // unless the dev wallet build is installed.
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
                        onShareProduct: handleShareProduct
                    )
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
            .task {
                addLog(
                    "Frak.initialize called for merchant 0a799880-ba54-4276-a734-db8721911bab (development)",
                    type: .info
                )
                await checkWalletInstalled()
                await resolveConfig()
                await loadCatalogReward()
            }
            // `CFBundleURLTypes` registration and this delivery path are the real thing.
            // `.manual` is the only `DeepLinkHandling` mode on iOS, so this call is
            // mandatory, not optional the way it might be on Android with `.automatic`.
            .onOpenURL { url in
                handleInboundURL(url)
            }
            // The presenting view for every "Share & Earn" tap — one sheet instance driven
            // by `pendingSharingRequest`/`isSharingPresented` rather than one per row, per
            // FrakSDKUI's own guidance (a preload-sharing web view per row would be wasteful).
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
            // A share is asking a friend to buy, not to visit or add-to-cart, so "purchase"
            // is the trigger this reward should be scoped to — matches the `rewards.best`
            // call below and Android's `SharingRequest`. See the parity note there.
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

    /// The deep-link simulator button and the real `.onOpenURL` delivery both funnel
    /// through here, matching Android — where the simulator dispatches a real Intent and
    /// so necessarily goes through the same `ActivityLifecycleCallbacks` path as a genuine
    /// inbound link. The old stub's simulator bypassed `.onOpenURL` entirely and called the
    /// SDK directly; that divergence is now gone.
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
            // `tracking.purchase` has no amount parameter to carry `sampleOrderTotalCents`
            // through anyway — the total above is display-only.
            let result = await client()?.tracking.purchase(
                customerId: sampleCustomerId,
                orderId: orderId,
                token: sampleCheckoutToken
            )
            switch result {
            case .success:
                addLog("Order \(orderId) tracked successfully.", type: .success)
            case .failure(let error):
                // Not expected against the real merchant id this harness configures — see README.
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
            // A real merchant id is configured, so a failure here means something is actually
            // wrong — e.g. this bundle id is not yet allow-listed for the merchant, or the dev
            // backend is unreachable. Not expected; see README.
            addLog("Config resolve failed: \(error.localizedDescription)", type: .error)
        }
    }

    /// One `rewards.best(...)` call for the entire visible catalog, not one per product. Per
    /// `RewardsAPI.best`'s doc comment (sdk/ios/Sources/FrakSDK/RewardsAPI.swift), a listing
    /// screen must call this once for the whole visible set and render a single headline
    /// figure: one call per row would multiply network requests and the resulting
    /// `BestReward?` still couldn't be attributed back to a single row. See
    /// `CatalogRewardLookup` and `ProductCatalogView`.
    private func loadCatalogReward() async {
        guard let client = client() else {
            addLog("Frak.client unavailable — skipping reward lookup.", type: .error)
            catalogReward = .failed
            return
        }
        do {
            let best = try await client.rewards.best(
                // Matches the `SharingRequest.targetInteraction` used by `handleShareProduct`
                // — see the comment there.
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
            // Not expected against the real merchant id this harness configures — see README.
            addLog(
                "Catalog reward lookup failed: \(error.localizedDescription)",
                type: .error
            )
            catalogReward = .failed
        }
    }

    /// `Frak.client` throws (not initialized) rather than being async, but every namespace
    /// call site here wants a plain optional to `guard`/`?.` against — this is that
    /// adaptation point, kept in one place instead of repeating `try?` everywhere.
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
                // One headline card for the whole catalog, not one per row — see
                // `FrakExampleApp.loadCatalogReward()`.
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

/// The single headline reward figure for the entire visible catalog. Deliberately not
/// per-product: see `FrakExampleApp.loadCatalogReward()`.
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
