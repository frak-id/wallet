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
import id.frak.sdk.sharing.SharingProduct
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.ui.FrakSharingLauncher
import id.frak.sdk.ui.SharingResult
import id.frak.sdk.ui.rememberFrakSharingLauncher
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

/**
 * The harness's own display model for a catalog row. Deliberately does not carry a reward
 * amount: [BestReward] is fetched **once** for the whole catalog, not per row — see
 * [MainActivity.loadCatalogReward] and [CatalogRewardBanner].
 *
 * Shared with the iOS harness — same ids, titles and links, so a divergence between the two
 * apps is visible in review.
 */
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

/**
 * The real SDK has no anonymous-checkout concept — `tracking.purchase` takes a merchant-owned
 * customer id and a checkout token the merchant's own backend would issue. Both are fabricated
 * here; a real integration wires these to its actual customer/checkout records.
 */
const val SAMPLE_CUSTOMER_ID = "cust_example_android_001"
const val SAMPLE_CHECKOUT_TOKEN = "checkout_token_example_9988"

/** Hoisted: allocating a formatter per log line is wasteful and this runs often. */
private val LOG_TIME_FORMAT = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

/** Display-only formatting for the order total; the reward amount itself now comes from [BestReward.formatted], which is already a ready-to-render string. */
fun formatCents(cents: Long): String = "$%d.%02d".format(cents / 100, cents % 100)

/** Where the catalog-wide `Frak.client.rewards.best` lookup currently stands. See [CatalogRewardBanner]. */
private sealed interface CatalogRewardLookup {
    data object Loading : CatalogRewardLookup

    data class Loaded(
        val reward: BestReward,
    ) : CatalogRewardLookup

    data object NoActiveReward : CatalogRewardLookup

    data object Failed : CatalogRewardLookup
}

class MainActivity : ComponentActivity() {
    private val logs = mutableStateListOf<LogEntry>()
    private var catalogReward by mutableStateOf<CatalogRewardLookup>(CatalogRewardLookup.Loading)

    private val catalogRewardLabel: String
        get() =
            when (val state = catalogReward) {
                CatalogRewardLookup.Loading -> "Checking catalog reward…"

                is CatalogRewardLookup.Loaded -> state.reward.formatted

                CatalogRewardLookup.NoActiveReward -> "No active reward"

                // Clearly-labelled placeholder, not a fabricated amount: the task this harness
                // exists for is proving the real call was made, not showing a pretty number.
                CatalogRewardLookup.Failed -> "Reward unavailable (placeholder)"
            }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        Frak.initialize(
            context = applicationContext,
            config =
                FrakConfig(
                    merchantId = "0a799880-ba54-4276-a734-db8721911bab",
                    metadata = FrakMetadata(name = "Frak Android Harness"),
                    // Points at wallet-dev.frak.id / backend.gcp-dev.frak.id and expects the DEV
                    // wallet app (`id.frak.wallet.dev`, scheme `frakwallet-dev`) rather than the
                    // production one — which is why `appLink.isFrakAppInstalled()` below reports
                    // false unless the dev wallet build is installed.
                    env = FrakEnvironment.Development,
                    // `DeepLinkHandling.Automatic` exists only on Android: it hooks
                    // `Application.ActivityLifecycleCallbacks`, which iOS has no equivalent of.
                    // iOS necessarily uses `.manual` and routes `.onOpenURL` to
                    // `appLink.handleReferral(_:)` by hand — see `FrakExampleApp.init()`.
                    deepLink = DeepLinkHandling.Automatic,
                    logLevel = FrakLogLevel.INFO,
                ),
        )
        addLog("Frak.initialize called for merchant 0a799880-ba54-4276-a734-db8721911bab (development)", LogType.INFO)

        intent?.dataString?.let { url -> logInboundIntent(url) }

        // Both of these are non-suspend/suspend calls that don't belong to any user gesture, so
        // they run once against the Activity's own lifecycleScope rather than needing a
        // composable's rememberCoroutineScope.
        lifecycleScope.launch {
            addLog("Frak wallet app installed: ${Frak.client.appLink.isFrakAppInstalled()}", LogType.INFO)
            try {
                val resolved = Frak.client.config.resolve()
                addLog("Merchant config resolved: ${resolved.name} (${resolved.domain})", LogType.SUCCESS)
            } catch (error: FrakError) {
                // A real merchant id is configured, so a failure here means something is
                // actually wrong — e.g. this bundle id is not yet allow-listed for the
                // merchant, or the dev backend is unreachable. Not expected; see README.
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
                    // Must live in the composable tree: FrakSharingLauncher is obtained from a
                    // @Composable function and its sheet is hosted as a composable, so it cannot
                    // be created or held from an Activity method the way the old stub's
                    // presentSharing(request, onResult) callback could.
                    val sharingLauncher = rememberFrakSharingLauncher { result -> logSharingResult(result) }

                    MerchantAppScreen(
                        logs = logs,
                        catalogRewardLabel = catalogRewardLabel,
                        onShareProduct = { product -> shareProduct(product, sharingLauncher) },
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
     * The config above uses `DeepLinkHandling.Automatic`, so `Frak.initialize` already registered
     * an `Application.ActivityLifecycleCallbacks` that reads this same Activity's intent from
     * `onActivityCreated`/`onActivityResumed` and calls `appLink.handleReferral` itself — that
     * dispatch happens right after this method returns. Calling `handleReferral` again here would
     * track the same arrival twice (it has no idempotency guard beyond self-referral detection),
     * so this only logs that the intent filter fired and the URL reached the activity; the actual
     * handling is intentionally left to the SDK. [simulateDeepLink] below is the one place this
     * harness calls `handleReferral` directly.
     */
    private fun logInboundIntent(url: String) {
        addLog("Inbound link reached the activity (SDK auto-handles it): $url", LogType.SUCCESS)
    }

    private fun shareProduct(
        product: ProductItem,
        launcher: FrakSharingLauncher,
    ) {
        addLog("Triggering sharing sheet for '${product.title}'...", LogType.INFO)
        launcher.launch(
            SharingRequest(
                products = listOf(SharingProduct(title = product.title, link = product.link)),
                // A share is asking a friend to buy, not to visit or add-to-cart, so "purchase"
                // is the trigger this reward should be scoped to — matches the `rewards.best`
                // call below and iOS's `SharingRequest`. See the parity note there.
                targetInteraction = "purchase",
                placement = "product-page",
            ),
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
     * Unlike a real inbound link, this URL never goes through `startActivity`/`onNewIntent` — it
     * is only ever passed straight to `handleReferral`. The SDK's automatic observer therefore
     * never sees it and there is no double-handling to worry about here, which is what makes this
     * the one place in the harness that calls `appLink.handleReferral` directly and logs its
     * result.
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

            // Not expected against the real merchant id this harness configures — see README.
            is FrakResult.Failure -> {
                addLog(
                    "Order $orderId tracking failed: ${result.error.message}",
                    LogType.ERROR,
                )
            }
        }
    }

    /**
     * One `rewards.best` call for the entire visible catalog, not one per row. Per
     * `RewardsApi.best`'s KDoc
     * (sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/RewardsApi.kt), a listing screen must
     * call this once for the whole visible set and render a single headline figure: one call
     * per row would mean one cache key and one network request per row against a small HTTP
     * concurrency budget, and the resulting `BestReward?` can't be attributed back to a single
     * row anyway. See [CatalogRewardBanner].
     */
    private suspend fun loadCatalogReward() {
        catalogReward =
            try {
                val best =
                    Frak.client.rewards.best(
                        // Matches the `SharingRequest.targetInteraction` used by [shareProduct]
                        // — see the comment there.
                        targetInteraction = "purchase",
                        products = sampleProducts.map { ProductDetails(productId = it.id, name = it.title) },
                    )
                if (best != null) {
                    addLog("Catalog reward: ${best.formatted}", LogType.SUCCESS)
                    CatalogRewardLookup.Loaded(best)
                } else {
                    addLog("No campaign matched the catalog.", LogType.INFO)
                    CatalogRewardLookup.NoActiveReward
                }
            } catch (error: FrakError) {
                // Not expected against the real merchant id this harness configures — see README.
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

        // Status Box / Log view
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
