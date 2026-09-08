package id.frak.example.android

import id.frak.sdk.core.ProductDetails
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.sharing.SharingProduct
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Currency
import java.util.Locale

/** Catalog row display model, shared with the iOS harness (same ids, titles, links, images). */
data class ProductItem(
    val id: String,
    val title: String,
    val link: String,
    val imageUrl: String,
    val priceCents: Long,
)

/** Store homepage, used by the unscoped share and as the collection landing page. */
const val STORE_LINK = "https://example.com"

val sampleProducts =
    listOf(
        ProductItem(
            id = "prod_001",
            title = "Babies camel cuir velours bout carré",
            link = "https://example.com/product-1",
            imageUrl = "https://picsum.photos/seed/frak-prod-001/600/600",
            priceCents = 14999,
        ),
        ProductItem(
            id = "prod_002",
            title = "Sneakers blanches classiques",
            link = "https://example.com/product-2",
            imageUrl = "https://picsum.photos/seed/frak-prod-002/600/600",
            priceCents = 8990,
        ),
        ProductItem(
            id = "prod_003",
            title = "Boots en cuir noir",
            link = "https://example.com/product-3",
            imageUrl = "https://picsum.photos/seed/frak-prod-003/600/600",
            priceCents = 21500,
        ),
    )

/** Order total used by the checkout simulator, shared with the iOS harness. */
const val SAMPLE_ORDER_TOTAL_CENTS = 14999L

/** `tracking.purchase` needs a customer id and checkout token; both are fabricated for the demo. */
const val SAMPLE_CUSTOMER_ID = "cust_example_android_001"
const val SAMPLE_CHECKOUT_TOKEN = "checkout_token_example_9988"

/** Until `config.resolve()` reports the merchant's own currency. */
const val FALLBACK_CURRENCY_CODE = "USD"

/** Hoisted: this runs per log line. */
val LOG_TIME_FORMAT: SimpleDateFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

/**
 * Formats a display amount in the merchant's resolved currency; reward amounts come from
 * [BestReward.formatted].
 */
fun formatCents(
    cents: Long,
    currencyCode: String = FALLBACK_CURRENCY_CODE,
): String {
    val format = NumberFormat.getCurrencyInstance(Locale.getDefault())
    runCatching { format.currency = Currency.getInstance(currencyCode) }
    return format.format(cents / 100.0)
}

/** Maps a catalog row onto the SDK's sharing model, images and scope fields included. */
fun sharingProduct(product: ProductItem): SharingProduct =
    SharingProduct(title = product.title, link = product.link) {
        imageUrl = product.imageUrl
        utmContent = product.id
        details =
            ProductDetails {
                productId = product.id
                name = product.title
            }
    }

data class LogEntry(
    val timestamp: String,
    val message: String,
    val type: LogType,
) {
    val exportLine: String get() = "[$timestamp] $message"
}

enum class LogType { INFO, SUCCESS, ERROR }

/** One label/value line of the SDK debug panel. */
data class DebugRow(
    val label: String,
    val value: String,
)

/** What the status strip reports about the live client. */
sealed interface SdkState {
    val label: String

    data object Checking : SdkState {
        override val label = "Connecting…"
    }

    data object Connected : SdkState {
        override val label = "Connected"
    }

    data class Failed(
        val reason: String,
    ) : SdkState {
        override val label = "Not working"
    }
}

/** State of the catalog-wide rewards.best lookup. */
sealed interface CatalogRewardLookup {
    val label: String

    data object Loading : CatalogRewardLookup {
        override val label = "Checking rewards…"
    }

    data class Loaded(
        val reward: BestReward,
    ) : CatalogRewardLookup {
        override val label get() = reward.formatted
    }

    data object NoActiveReward : CatalogRewardLookup {
        override val label = "No reward running right now"
    }

    data object Failed : CatalogRewardLookup {
        override val label = "Rewards unavailable"
    }
}
