package id.frak.example.android

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import id.frak.example.android.ui.FrakColorScheme
import id.frak.example.android.ui.FrakTheme
import id.frak.sdk.Frak
import id.frak.sdk.core.DeepLinkHandling
import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakEnvironment
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakMetadata
import id.frak.sdk.core.FrakResult
import id.frak.sdk.core.ProductDetails
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.rewards.RewardRequest
import id.frak.sdk.sharing.SharingProduct
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.ui.FrakSharing
import id.frak.sdk.ui.SharingResult
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class LogEntry(
    val timestamp: String,
    val message: String,
    val type: LogType,
)

enum class LogType { INFO, SUCCESS, ERROR }

/** Catalog row display model, shared with the iOS harness (same ids, titles, links). */
data class ProductItem(
    val id: String,
    val title: String,
    val link: String,
)

val sampleProducts =
    listOf(
        ProductItem(
            id = "prod_001",
            title = "Babies camel cuir velours bout carré",
            link = "https://example.com/product-1",
        ),
        ProductItem(
            id = "prod_002",
            title = "Sneakers blanches classiques",
            link = "https://example.com/product-2",
        ),
        ProductItem(
            id = "prod_003",
            title = "Boots en cuir noir",
            link = "https://example.com/product-3",
        ),
    )

/** Order total used by the checkout simulator, shared with the iOS harness. */
const val SAMPLE_ORDER_TOTAL_CENTS = 14999L

/** `tracking.purchase` needs a merchant-owned customer id and checkout token; both are fabricated here for the demo. */
const val SAMPLE_CUSTOMER_ID = "cust_example_android_001"
const val SAMPLE_CHECKOUT_TOKEN = "checkout_token_example_9988"

/** Hoisted: allocating a formatter per log line is wasteful and this runs often. */
private val LOG_TIME_FORMAT = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

/** Formats the order total only; reward amounts come from [BestReward.formatted]. */
fun formatCents(cents: Long): String = "$%d.%02d".format(cents / 100, cents % 100)

/** State of the catalog-wide rewards.best lookup. See [CatalogRewardBanner]. */
private sealed interface CatalogRewardLookup {
    data object Loading : CatalogRewardLookup

    data class Loaded(
        val reward: BestReward,
    ) : CatalogRewardLookup

    data object NoActiveReward : CatalogRewardLookup

    data object Failed : CatalogRewardLookup
}

class MainActivity : ComponentActivity() {
    /**
     * The plain-Activity build site, on purpose: this harness is Compose top to bottom and could
     * have used the `@Composable build()`, but the XML/Java path is the one nothing has ever
     * exercised. Driving the harness through it is the only pressure this repo puts on it.
     *
     * `lateinit` + `onCreate`, not a property initialiser. Property initialisers run in the
     * Activity's constructor, before the framework has attached the `Application` — and
     * `build(activity)` needs the `ViewModelStore`, which does not exist that early. It says so,
     * and now throws a legible `IllegalStateException` if anyone tries.
     */
    private lateinit var sharing: FrakSharing

    private val logs = mutableStateListOf<LogEntry>()
    private var catalogReward by mutableStateOf<CatalogRewardLookup>(CatalogRewardLookup.Loading)

    private val catalogRewardLabel: String
        get() =
            when (val state = catalogReward) {
                CatalogRewardLookup.Loading -> "Checking catalog reward…"
                is CatalogRewardLookup.Loaded -> state.reward.formatted
                CatalogRewardLookup.NoActiveReward -> "No active reward"
                CatalogRewardLookup.Failed -> "Reward unavailable (placeholder)"
            }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        sharing = FrakSharing.Builder(::logSharingResult).build(this)

        Frak.initialize(
            context = applicationContext,
            // The Kotlin sugar over `FrakConfig.Builder`, which is the same Builder a Java or XML
            // host would chain by hand. Assignment syntax, no default arguments anywhere on the way
            // in — see `docs/plans/native-sdk/09-android-api-surface.md` §1.
            config =
                FrakConfig(merchantId = "0a799880-ba54-4276-a734-db8721911bab") {
                    metadata = FrakMetadata { name = "Frak Android Harness" }
                    // Development points at wallet-dev.frak.id / backend.gcp-dev.frak.id and the
                    // dev wallet app (id.frak.wallet.dev, scheme frakwallet-dev). isFrakAppInstalled()
                    // below reports false without it.
                    env = FrakEnvironment.Development
                    // Automatic exists only on Android (hooks ActivityLifecycleCallbacks). iOS uses
                    // .manual and routes .onOpenURL to appLink.handleReferral(_:) by hand.
                    deepLink = DeepLinkHandling.Automatic
                    logLevel = FrakLogLevel.INFO
                    // Boots a web view against the wallet origin as soon as a share surface is
                    // composed, and hands that same warm view to the sheet. Without it the sheet
                    // pays for engine startup, TLS and the React bundle at tap time — the
                    // 200-300ms of blank white this harness exists to catch. On by default here
                    // precisely because the harness is where that regression would show up.
                    preloadSharing = true
                },
        )
        addLog("Frak.initialize called for merchant 0a799880-ba54-4276-a734-db8721911bab (development)", LogType.INFO)

        // Explicit, because this is not the Compose build site: the `@Composable build()` warms on
        // composition-enter, a plain-Activity one cannot know when a share affordance appears. Here
        // it is honest at onCreate — the first screen this harness shows is the catalog, and every
        // row on it has a Share button. A merchant whose share surface is three taps in should call
        // this when that surface appears, not here; warming boots a WebView and does two round
        // trips, and doing it on every cold start for a share nobody asked for is the regression
        // the warm/build split exists to prevent.
        sharing.warm()

        intent?.dataString?.let { url -> logInboundIntent(url) }

        lifecycleScope.launch {
            addLog("Frak wallet app installed: ${Frak.client.appLink.isFrakAppInstalled()}", LogType.INFO)
            try {
                val resolved = Frak.client.config.resolve()
                addLog("Merchant config resolved: ${resolved.name} (${resolved.domain})", LogType.SUCCESS)
            } catch (error: FrakError) {
                addLog("Config resolve failed: ${error.message}", LogType.ERROR)
            }
            loadCatalogReward()
        }

        setContent {
            MaterialTheme(colorScheme = FrakColorScheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    val scope = rememberCoroutineScope()

                    MerchantAppScreen(
                        logs = logs,
                        catalogRewardLabel = catalogRewardLabel,
                        onShareProduct = ::shareProduct,
                        onSimulateDeepLink = { scope.launch { simulateDeepLink() } },
                        onOrderCompleted = { scope.launch { completeOrder() } },
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.dataString?.let { url -> logInboundIntent(url) }
    }

    /**
     * Automatic mode already dispatched `handleReferral` via the activity lifecycle callback;
     * this only logs the arrival. Calling `handleReferral` again would double-track it.
     */
    private fun logInboundIntent(url: String) {
        addLog("Inbound link reached the activity (SDK auto-handles it): $url", LogType.SUCCESS)
    }

    private fun shareProduct(product: ProductItem) {
        addLog("Triggering sharing sheet for '${product.title}'...", LogType.INFO)
        sharing.present(
            SharingRequest {
                products = listOf(SharingProduct(title = product.title, link = product.link))
                // Reward trigger is "purchase" — matches the rewards.best call below and iOS's
                // SharingRequest.
                targetInteraction = "purchase"
                placement = "product-page"
            },
        )
    }

    private fun logSharingResult(result: SharingResult) {
        when (result) {
            is SharingResult.Shared -> addLog("Reward link shared: ${result.link}", LogType.SUCCESS)
            is SharingResult.Copied -> addLog("Reward link copied to clipboard: ${result.link}", LogType.SUCCESS)
            SharingResult.InstallStarted -> addLog("Wallet install flow started by the sharing sheet.", LogType.INFO)
            SharingResult.Dismissed -> addLog("Sharing sheet dismissed by user.", LogType.INFO)
            is SharingResult.Failed -> addLog("Sharing failed: ${result.error.message}", LogType.ERROR)
        }
    }

    /**
     * Passes the URL straight to `handleReferral`, bypassing `startActivity`/`onNewIntent` — the
     * only place in the harness that calls it directly.
     */
    private suspend fun simulateDeepLink() {
        val testUrl = "https://example-merchant.com/product?fCtx=test_referral_token_android_9988"
        addLog("Simulating inbound referral link: $testUrl", LogType.INFO)
        try {
            val handled = Frak.client.appLink.handleReferral(testUrl)
            addLog("appLink.handleReferral(...) returned $handled", if (handled) LogType.SUCCESS else LogType.INFO)
        } catch (error: FrakError) {
            addLog("appLink.handleReferral(...) failed: ${error.message}", LogType.ERROR)
        }
    }

    private suspend fun completeOrder() {
        val orderId = "ord_${System.currentTimeMillis()}"
        addLog("Completing order $orderId (${formatCents(SAMPLE_ORDER_TOTAL_CENTS)})...", LogType.INFO)
        when (
            val result =
                Frak.client.tracking.purchase(
                    customerId = SAMPLE_CUSTOMER_ID,
                    orderId = orderId,
                    token = SAMPLE_CHECKOUT_TOKEN,
                )
        ) {
            is FrakResult.Success -> {
                addLog("Order $orderId tracked successfully.", LogType.SUCCESS)
            }

            is FrakResult.Failure -> {
                addLog(
                    "Order $orderId tracking failed: ${result.error.message}",
                    LogType.ERROR,
                )
            }
        }
    }

    /** One `rewards.best` call for the whole visible catalog, not one per row. See [CatalogRewardBanner]. */
    private suspend fun loadCatalogReward() {
        catalogReward =
            try {
                val best =
                    Frak.client.rewards.best(
                        RewardRequest {
                            // Matches SharingRequest.targetInteraction used by shareProduct.
                            targetInteraction = "purchase"
                            products =
                                sampleProducts.map { product ->
                                    ProductDetails {
                                        productId = product.id
                                        name = product.title
                                    }
                                }
                        },
                    )
                if (best != null) {
                    addLog("Catalog reward: ${best.formatted}", LogType.SUCCESS)
                    CatalogRewardLookup.Loaded(best)
                } else {
                    addLog("No campaign matched the catalog.", LogType.INFO)
                    CatalogRewardLookup.NoActiveReward
                }
            } catch (error: FrakError) {
                addLog("Catalog reward lookup failed: ${error.message}", LogType.ERROR)
                CatalogRewardLookup.Failed
            }
    }

    private fun addLog(
        message: String,
        type: LogType,
    ) {
        val timeStr = LOG_TIME_FORMAT.format(Date())
        logs.add(0, LogEntry(timeStr, message, type))
    }
}

@Composable
fun MerchantAppScreen(
    logs: List<LogEntry>,
    catalogRewardLabel: String,
    onShareProduct: (ProductItem) -> Unit,
    onSimulateDeepLink: () -> Unit,
    onOrderCompleted: () -> Unit,
) {
    var activeTab by remember { mutableIntStateOf(0) }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(16.dp),
    ) {
        Text(
            text = "Frak Merchant Android Harness",
            style = MaterialTheme.typography.headlineSmall,
            color = FrakTheme.textPrimary,
            modifier = Modifier.padding(bottom = 8.dp),
        )

        Card(
            colors =
                CardDefaults.cardColors(
                    containerColor = FrakTheme.surfaceSecondary,
                ),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
        ) {
            Text(
                text =
                    "Wired to the real Frak SDK against the Frak development backend, using a " +
                        "real merchant id — network calls below are expected to succeed.",
                color = FrakTheme.textPrimary,
                modifier = Modifier.padding(10.dp),
                style = MaterialTheme.typography.bodyMedium,
            )
        }

        TabRow(selectedTabIndex = activeTab) {
            Tab(selected = activeTab == 0, onClick = { activeTab = 0 }) {
                Text("Product Catalog", modifier = Modifier.padding(10.dp))
            }
            Tab(selected = activeTab == 1, onClick = { activeTab = 1 }) {
                Text("Checkout & Tools", modifier = Modifier.padding(10.dp))
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Box(modifier = Modifier.weight(1f)) {
            if (activeTab == 0) {
                ProductList(
                    products = sampleProducts,
                    catalogRewardLabel = catalogRewardLabel,
                    onShareProduct = onShareProduct,
                )
            } else {
                CheckoutToolsView(
                    onSimulateDeepLink = onSimulateDeepLink,
                    onOrderCompleted = onOrderCompleted,
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "SDK Event Log:",
            style = MaterialTheme.typography.labelMedium,
            color = FrakTheme.textPrimary,
        )
        Card(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(140.dp)
                    .border(1.dp, FrakTheme.borderDefault, RoundedCornerShape(8.dp)),
        ) {
            LazyColumn(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(FrakTheme.consoleSurface)
                        .padding(8.dp),
            ) {
                items(logs) { entry ->
                    val color =
                        when (entry.type) {
                            LogType.INFO -> FrakTheme.consoleInfo
                            LogType.SUCCESS -> FrakTheme.consoleSuccess
                            LogType.ERROR -> FrakTheme.consoleError
                        }
                    Text(
                        text = "[${entry.timestamp}] ${entry.message}",
                        color = color,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(vertical = 2.dp),
                    )
                }
            }
        }
    }
}

@Composable
fun ProductList(
    products: List<ProductItem>,
    catalogRewardLabel: String,
    onShareProduct: (ProductItem) -> Unit,
) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // One headline card for the whole catalog, not one per row — see
        // `MainActivity.loadCatalogReward`.
        item {
            CatalogRewardBanner(label = catalogRewardLabel)
        }
        items(products) { product ->
            ProductCard(product = product, onShareProduct = onShareProduct)
        }
    }
}

/**
 * The single headline reward figure for the entire visible catalog. Deliberately not
 * per-[ProductCard]: see `MainActivity.loadCatalogReward`.
 */
@Composable
private fun CatalogRewardBanner(label: String) {
    Card(
        colors =
            CardDefaults.cardColors(
                containerColor = FrakTheme.surfaceSecondary,
            ),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = "Catalog Reward",
                style = MaterialTheme.typography.labelMedium,
                color = FrakTheme.textPrimary,
            )
            Text(
                text = label,
                style = MaterialTheme.typography.titleMedium,
                color = FrakTheme.textAction,
            )
        }
    }
}

@Composable
private fun ProductCard(
    product: ProductItem,
    onShareProduct: (ProductItem) -> Unit,
) {
    Card(
        colors =
            CardDefaults.cardColors(
                containerColor = FrakTheme.surfaceBackground2,
            ),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = product.title,
                style = MaterialTheme.typography.titleMedium,
                color = FrakTheme.textPrimary,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = { onShareProduct(product) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Share Product")
            }
        }
    }
}

@Composable
fun CheckoutToolsView(
    onSimulateDeepLink: () -> Unit,
    onOrderCompleted: () -> Unit,
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Card(
            colors =
                CardDefaults.cardColors(
                    containerColor = FrakTheme.surfaceBackground2,
                ),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    text = "Order Confirmation Test",
                    style = MaterialTheme.typography.titleMedium,
                    color = FrakTheme.textPrimary,
                )
                Text(
                    text =
                        "Simulate completing a purchase order " +
                            "(#ORD-98231, ${formatCents(SAMPLE_ORDER_TOTAL_CENTS)})",
                    style = MaterialTheme.typography.bodySmall,
                    color = FrakTheme.textSecondary,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    onClick = onOrderCompleted,
                    colors =
                        ButtonDefaults.buttonColors(
                            containerColor = FrakTheme.success,
                            contentColor = FrakTheme.textOnAction,
                        ),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Complete Order & Track Purchase")
                }
            }
        }

        Card(
            colors =
                CardDefaults.cardColors(
                    containerColor = FrakTheme.surfaceBackground2,
                ),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(modifier = Modifier.padding(12.dp)) {
                Text(
                    text = "Referral Deep Link Simulator",
                    style = MaterialTheme.typography.titleMedium,
                    color = FrakTheme.textPrimary,
                )
                Text(
                    text = "Simulate user opening app from an inbound referral link with fCtx",
                    style = MaterialTheme.typography.bodySmall,
                    color = FrakTheme.textSecondary,
                )
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(onClick = onSimulateDeepLink, modifier = Modifier.fillMaxWidth()) {
                    Text("Simulate Inbound fCtx Link")
                }
            }
        }
    }
}
