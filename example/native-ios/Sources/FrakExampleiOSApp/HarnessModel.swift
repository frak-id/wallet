import Foundation
import FrakSDK
import FrakSDKUI
import SwiftUI
import os

/// Every SDK call the harness makes, plus the state the three tabs render.
@MainActor
final class HarnessModel: ObservableObject {
    /// Bounded so a long test session cannot grow the log without limit.
    private static let maxLogEntries = 300

    /// Distinct from the SDK's own subsystem so a run can separate app from SDK.
    private let logger = Logger(subsystem: "id.frak.example.ios", category: "FrakHarness")

    @Published private(set) var logs: [LogEntry] = []
    @Published private(set) var debugRows: [DebugRow] = []
    @Published private(set) var catalogReward: CatalogRewardLookup = .loading
    @Published private(set) var sdkState: SdkState = .checking
    @Published private(set) var walletInstalled: Bool?
    @Published private(set) var currencyCode = fallbackCurrencyCode
    @Published var isDebugRefreshing = false
    @Published var selectedEnvironment = HarnessEnvironmentStore.read()
    @Published var isSharingPresented = false
    @Published var pendingSharingRequest = SharingRequest()

    var pendingRestart: Bool { selectedEnvironment != activeEnvironment }

    var logExport: String {
        logs.reversed().map(\.exportLine).joined(separator: "\n")
    }

    var debugExport: String {
        debugRows.map { "\($0.label): \($0.value)" }.joined(separator: "\n")
    }

    func start() async {
        addLog(
            "Frak.initialize called for merchant \(activeEnvironment.merchantId) "
                + "(\(activeEnvironment.label))",
            type: .info
        )
        await checkWalletInstalled()
        await resolveConfig()
        await loadCatalogReward()
        await refreshDebugInfo(log: false)
    }

    /// Persists only. Switching in place would leave the sharing sheet's pooled web view on the
    /// previous stage's wallet origin, and `Frak.shutdown()` does not stop every background task.
    func selectEnvironment(_ environment: HarnessEnvironment) {
        selectedEnvironment = environment
        HarnessEnvironmentStore.write(environment)
        guard environment != activeEnvironment else {
            addLog("Environment stays \(environment.label) on the next launch.", type: .info)
            return
        }
        addLog("Environment set to \(environment.label). Relaunch the app to apply it.", type: .info)
    }

    /// Share #1: no products at all — the link falls back to the merchant homepage.
    func shareStore() {
        addLog("Opening the share sheet for the whole store...", type: .info)
        pendingSharingRequest = SharingRequest(
            targetInteraction: "purchase",
            placement: "home"
        )
        isSharingPresented = true
    }

    /// Share #2: exactly one product, scoped and illustrated.
    func shareProduct(_ product: ProductItem) {
        addLog("Opening the share sheet for '\(product.title)'...", type: .info)
        pendingSharingRequest = SharingRequest(
            products: [sharingProduct(product)],
            // Matches the rewards.best call below.
            targetInteraction: "purchase",
            placement: "product-page"
        )
        isSharingPresented = true
    }

    /// Share #3: the whole catalog, so the sheet renders several illustrated product cards.
    func shareCollection() {
        addLog("Opening the share sheet for \(sampleProducts.count) products...", type: .info)
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

    func handleSharingResult(_ result: SharingResult) {
        switch result {
        case .shared(let link):
            addLog("Reward link shared: \(link)", type: .success)
        case .copied(let link):
            addLog("Reward link copied to clipboard: \(link)", type: .success)
        case .installStarted:
            addLog("Wallet install flow started by the sharing sheet.", type: .info)
        case .walletOpened:
            addLog("Wallet opened with the sharing sheet's identity handoff.", type: .success)
        case .dismissed:
            addLog("Sharing sheet dismissed by user.", type: .info)
        case .failed(let error):
            addLog("Sharing failed: \(error.localizedDescription)", type: .error)
        }
    }

    /// Both the deep-link simulator button and `.onOpenURL` delivery funnel through here.
    func handleInboundURL(_ url: URL) async {
        addLog("Inbound link reached the app: \(url)", type: .info)
        do {
            let client = try Frak.client
            let hadReferral = await client.appLink.handleReferral(url)
            addLog(
                hadReferral
                    ? "Referral recognized — this visit is attributed to the sharer."
                    : "That link carried no Frak referral.",
                type: hadReferral ? .success : .info
            )
        } catch {
            addLog("Frak.client unavailable: \(error.localizedDescription)", type: .error)
        }
    }

    func simulateDeepLink() async {
        let raw = "https://example-merchant.com/product?fCtx=test_referral_token_ios_9988"
        guard let url = URL(string: raw) else { return }
        addLog("Simulating an inbound referral link...", type: .info)
        await handleInboundURL(url)
    }

    func completeOrder() async {
        let orderId = "ord_\(Int(Date().timeIntervalSince1970))"
        addLog(
            "Completing order \(orderId) (\(formatCents(sampleOrderTotalCents, currencyCode: currencyCode)))...",
            type: .info
        )
        // tracking.purchase has no amount parameter; the total above is display-only.
        let result = await client()?.tracking.purchase(
            customerId: sampleCustomerId,
            orderId: orderId,
            token: sampleCheckoutToken
        )
        switch result {
        case .success:
            addLog("Order \(orderId) sent to Frak.", type: .success)
        case .failure(let error):
            addLog("Order \(orderId) tracking failed: \(error.localizedDescription)", type: .error)
        case nil:
            addLog("Frak.client unavailable — order \(orderId) not tracked.", type: .error)
        }
    }

    func clearLogs() {
        logs.removeAll()
        addLog("Log cleared.", type: .info)
    }

    private func checkWalletInstalled() async {
        guard let client = client() else {
            addLog("Frak.client unavailable — skipping wallet-installed check.", type: .error)
            return
        }
        let installed = await client.appLink.isFrakAppInstalled()
        walletInstalled = installed
        addLog("Frak wallet app installed: \(installed)", type: .info)
    }

    private func resolveConfig() async {
        guard let client = client() else {
            sdkState = .failed("client unavailable")
            addLog("Frak.client unavailable — skipping config resolve.", type: .error)
            return
        }
        do {
            let resolved = try await client.config.resolve()
            currencyCode = resolved.currency?.rawValue ?? fallbackCurrencyCode
            sdkState = .connected
            addLog("Merchant config resolved: \(resolved.name) (\(resolved.domain))", type: .success)
        } catch {
            sdkState = .failed(error.localizedDescription)
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
                RewardRequest(
                    // Matches SharingRequest.targetInteraction used by shareProduct.
                    targetInteraction: "purchase",
                    products: sampleProducts.map { ProductDetails(productId: $0.id, name: $0.title) }
                )
            )
            if let best {
                catalogReward = .loaded(best)
                addLog("Catalog reward: \(best.formatted)", type: .success)
            } else {
                catalogReward = .noActiveReward
                addLog("No campaign matched the catalog.", type: .info)
            }
        } catch {
            addLog("Catalog reward lookup failed: \(error.localizedDescription)", type: .error)
            catalogReward = .failed
        }
    }

    /// Every wiring fact the SDK can answer for, in one snapshot: the configured merchant id next
    /// to the one the backend resolved, the identity events are attributed to, and the origins the
    /// calls actually go to.
    func refreshDebugInfo(log: Bool) async {
        isDebugRefreshing = true
        defer { isDebugRefreshing = false }

        var rows = [
            DebugRow(label: "App build", value: harnessBuildLabel),
            DebugRow(label: "SDK version", value: FrakSDKVersion.current),
            DebugRow(label: "Harness environment", value: activeEnvironment.label),
            DebugRow(label: "Configured merchant id", value: activeEnvironment.merchantId),
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

        let installed = await client.appLink.isFrakAppInstalled()
        walletInstalled = installed
        rows.append(DebugRow(label: "Wallet app installed", value: "\(installed)"))
        rows.append(DebugRow(label: "Tracking enabled", value: "\(await client.isTrackingEnabled())"))
        rows.append(
            DebugRow(
                label: "Anonymous id",
                value: await client.anonymousId ?? "none (tracking off or key refused)"
            )
        )

        do {
            let resolved = try await client.config.resolve()
            currencyCode = resolved.currency?.rawValue ?? fallbackCurrencyCode
            sdkState = .connected
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
            sdkState = .failed(error.localizedDescription)
            rows.append(DebugRow(label: "Resolved config", value: "failed: \(error.localizedDescription)"))
        }

        debugRows = rows
        if log { addLog("SDK debug info refreshed (\(rows.count) fields).", type: .success) }
    }

    /// Adapts `Frak.client`'s throw to a plain optional, in one place.
    private func client() -> FrakClient? {
        try? Frak.client
    }

    func addLog(_ message: String, type: LogEntry.LogType) {
        let timestamp = logTimeFormatter.string(from: Date())
        logs.insert(LogEntry(timestamp: timestamp, message: message, type: type), at: 0)
        if logs.count > Self.maxLogEntries {
            logs.removeLast(logs.count - Self.maxLogEntries)
        }
        // Mirrored so a device run is greppable from the console instead of read off the screen.
        switch type {
        case .error: logger.error("\(message, privacy: .public)")
        default: logger.info("\(message, privacy: .public)")
        }
    }
}
