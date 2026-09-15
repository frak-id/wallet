import Foundation
import FrakSDK

/// Catalog row display model, local to this harness.
struct ProductItem: Identifiable, Sendable {
    let id: String
    let title: String
    let link: String
    let imageURL: String
    let priceCents: Int64
}

/// The stage this process initialized against. Read once at launch; the picker in *Debug* only
/// writes the next launch's value.
let activeEnvironment = HarnessEnvironmentStore.read()

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

/// Until `config.resolve()` reports the merchant's own currency.
let fallbackCurrencyCode = "USD"

/// Hoisted: `DateFormatter` is expensive to build and this runs per log line.
let logTimeFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateFormat = "HH:mm:ss"
    return formatter
}()

/// Formats a display amount in the merchant's resolved currency; reward amounts come from
/// `BestReward.formatted`.
func formatCents(_ cents: Int64, currencyCode: String = fallbackCurrencyCode) -> String {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = currencyCode
    let amount = NSNumber(value: Double(cents) / 100)
    return formatter.string(from: amount) ?? "\(Double(cents) / 100) \(currencyCode)"
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

/// Marketing version and build number of the running bundle, so a tester can name their build.
let harnessBuildLabel: String = {
    let info = Bundle.main.infoDictionary
    let version = info?["CFBundleShortVersionString"] as? String ?? "?"
    let build = info?["CFBundleVersion"] as? String ?? "?"
    return "\(version) (\(build))"
}()

struct LogEntry: Identifiable {
    let id = UUID()
    let timestamp: String
    let message: String
    let type: LogType

    enum LogType {
        case info, success, error
    }

    var exportLine: String { "[\(timestamp)] \(message)" }
}

/// One label/value line of the SDK debug panel.
struct DebugRow: Identifiable {
    let label: String
    let value: String

    var id: String { label }
}

/// What the status strip reports about the live client.
enum SdkState {
    case checking
    case connected
    case failed(String)

    var label: String {
        switch self {
        case .checking: return "Connecting…"
        case .connected: return "Connected"
        case .failed: return "Not working"
        }
    }
}

/// State of the catalog-wide rewards.best lookup.
enum CatalogRewardLookup {
    case loading
    case loaded(BestReward)
    case noActiveReward
    case failed

    var label: String {
        switch self {
        case .loading: return "Checking rewards…"
        case .loaded(let reward): return reward.formatted
        case .noActiveReward: return "No reward running right now"
        case .failed: return "Rewards unavailable"
        }
    }
}
