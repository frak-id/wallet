import FrakSDK
import FrakSDKUI
import SwiftUI

@main
struct FrakExampleApp: App {
    @StateObject private var model = HarnessModel()

    init() {
        // .manual is the only DeepLinkHandling option on iOS: inbound URLs are routed to
        // appLink.handleReferral(_:) by hand — see .onOpenURL below.
        Frak.initialize(
            FrakConfig(
                merchantId: activeEnvironment.merchantId,
                metadata: FrakMetadata(
                    name: "Frak iOS Harness",
                    // Last fallback of the share link chain, so the unscoped share
                    // (no link, no products) still has something to link to.
                    homepageLink: storeLink
                ),
                // Each stage has its own wallet URL scheme, so isFrakAppInstalled() only reports
                // true for the wallet build matching this one.
                env: activeEnvironment.frakEnvironment,
                deepLink: .manual,
                logLevel: .info
            )
        )
    }

    var body: some Scene {
        WindowGroup {
            RootView(model: model)
        }
    }
}

private enum HarnessTab: Int, CaseIterable, Identifiable {
    case shop, checkout, debug

    var id: Int { rawValue }

    var label: String {
        switch self {
        case .shop: return "Shop"
        case .checkout: return "Checkout"
        case .debug: return "Debug"
        }
    }
}

struct RootView: View {
    @ObservedObject var model: HarnessModel
    @State private var tab: HarnessTab = .shop

    var body: some View {
        VStack(spacing: 12) {
            Text("Frak Demo Store")
                .font(.title2)
                .bold()
                .foregroundColor(FrakTheme.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)

            StatusStrip(
                environment: activeEnvironment,
                sdkState: model.sdkState,
                walletInstalled: model.walletInstalled,
                sdkVersion: FrakSDKVersion.current
            )

            Picker("View", selection: $tab) {
                ForEach(HarnessTab.allCases) { entry in
                    Text(entry.label).tag(entry)
                }
            }
            .pickerStyle(SegmentedPickerStyle())

            content

            LogConsole(
                logs: model.logs,
                exportText: model.logExport,
                onClear: model.clearLogs
            )
        }
        .padding()
        .task {
            await model.start()
        }
        // .manual is the only mode on iOS, so this call is mandatory.
        .onOpenURL { url in
            Task { await model.handleInboundURL(url) }
        }
        // One sheet instance for every entry point, driven by pendingSharingRequest.
        .frakSharingSheet(
            isPresented: $model.isSharingPresented,
            request: model.pendingSharingRequest,
            onResult: model.handleSharingResult
        )
    }

    @ViewBuilder
    private var content: some View {
        switch tab {
        case .shop:
            ShopTab(
                products: sampleProducts,
                catalogRewardLabel: model.catalogReward.label,
                currencyCode: model.currencyCode,
                onShareStore: model.shareStore,
                onShareProduct: model.shareProduct,
                onShareCollection: model.shareCollection
            )
        case .checkout:
            CheckoutTab(
                currencyCode: model.currencyCode,
                onOrderCompleted: { Task { await model.completeOrder() } },
                onSimulateDeepLink: { Task { await model.simulateDeepLink() } }
            )
        case .debug:
            DebugTab(
                selectedEnvironment: $model.selectedEnvironment,
                onSelectEnvironment: model.selectEnvironment,
                debugRows: model.debugRows,
                debugExport: model.debugExport,
                isDebugRefreshing: model.isDebugRefreshing,
                onRefreshDebugInfo: { Task { await model.refreshDebugInfo(log: true) } }
            )
        }
    }
}
