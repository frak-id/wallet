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
import androidx.compose.foundation.layout.Row
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
import id.frak.sdk.FrakSdkVersion
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

/** Catalog row display model, shared with the iOS harness (same ids, titles, links, images). */
data class ProductItem(
    val id: String,
    val title: String,
    val link: String,
    val imageUrl: String,
    val priceCents: Long,
)

/** Configured merchant id, echoed in the debug panel next to the one the backend resolves. */
const val MERCHANT_ID = "0a799880-ba54-4276-a734-db8721911bab"

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

/** Hoisted: this runs per log line. */
private val LOG_TIME_FORMAT = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

/** Formats the order total only; reward amounts come from [BestReward.formatted]. */
fun formatCents(cents: Long): String = "$%d.%02d".format(cents / 100, cents % 100)

/** State of the catalog-wide rewards.best lookup. */
private sealed interface CatalogRewardLookup {
    data object Loading : CatalogRewardLookup

    data class Loaded(
        val reward: BestReward,
    ) : CatalogRewardLookup

    data object NoActiveReward : CatalogRewardLookup

    data object Failed : CatalogRewardLookup
}

/** One label/value line of the SDK debug panel. */
data class DebugRow(
    val label: String,
    val value: String,
)

class MainActivity : ComponentActivity() {
    /**
     * Built in `onCreate` rather than as a property initialiser: `build(activity)` needs the
     * `ViewModelStore`, which does not exist that early.
     */
    private lateinit var sharing: FrakSharing

    private val logs = mutableStateListOf<LogEntry>()
    private val debugRows = mutableStateListOf<DebugRow>()
    private var isDebugRefreshing by mutableStateOf(false)
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
            config =
                FrakConfig(merchantId = MERCHANT_ID) {
                    metadata =
                        FrakMetadata {
                            name = "Frak Android Harness"
                            // Last fallback of the share link chain, so the unscoped share
                            // (no link, no products) still has something to link to.
                            homepageLink = STORE_LINK
                        }
                    // Development points at the dev wallet app; isFrakAppInstalled() reports
                    // false without it.
                    env = FrakEnvironment.Development
                    // Automatic exists only on Android; iOS routes .onOpenURL by hand.
                    deepLink = DeepLinkHandling.Automatic
                    logLevel = FrakLogLevel.INFO
                },
        )
        addLog("Frak.initialize called for merchant $MERCHANT_ID (development)", LogType.INFO)

        // Not the Compose build site, so warming has to be explicit. A merchant whose share
        // surface is several taps in should warm when that surface appears, not at startup.
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
            refreshDebugInfo(log = false)
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
                        debugRows = debugRows,
                        isDebugRefreshing = isDebugRefreshing,
                        onShareStore = ::shareStore,
                        onShareProduct = ::shareProduct,
                        onShareCollection = ::shareCollection,
                        onSimulateDeepLink = { scope.launch { simulateDeepLink() } },
                        onOrderCompleted = { scope.launch { completeOrder() } },
                        onRefreshDebugInfo = { scope.launch { refreshDebugInfo(log = true) } },
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.dataString?.let { url -> logInboundIntent(url) }
    }

    /** Automatic mode already dispatched `handleReferral`; calling it again would double-track. */
    private fun logInboundIntent(url: String) {
        addLog("Inbound link reached the activity (SDK auto-handles it): $url", LogType.SUCCESS)
    }

    /** Share #1: no products at all — the link falls back to the merchant homepage. */
    private fun shareStore() {
        addLog("Triggering sharing sheet with no product scope...", LogType.INFO)
        sharing.present(
            SharingRequest {
                targetInteraction = "purchase"
                placement = "home"
            },
        )
    }

    /** Share #2: exactly one product, scoped and illustrated. */
    private fun shareProduct(product: ProductItem) {
        addLog("Triggering sharing sheet for '${product.title}'...", LogType.INFO)
        sharing.present(
            SharingRequest {
                products = listOf(sharingProduct(product))
                // Matches the rewards.best call below.
                targetInteraction = "purchase"
                placement = "product-page"
            },
        )
    }

    /** Share #3: the whole catalog, so the sheet renders several illustrated product cards. */
    private fun shareCollection() {
        addLog("Triggering sharing sheet for ${sampleProducts.size} products...", LogType.INFO)
        sharing.present(
            SharingRequest {
                // Products carry their own links, so the shared URL has to be stated: without it
                // the first product's link would win and the recipient would miss the collection.
                link = "$STORE_LINK/collections/best-sellers"
                products = sampleProducts.map(::sharingProduct)
                targetInteraction = "purchase"
                placement = "category-page"
            },
        )
    }

    private fun sharingProduct(product: ProductItem): SharingProduct =
        SharingProduct(title = product.title, link = product.link) {
            imageUrl = product.imageUrl
            utmContent = product.id
            details =
                ProductDetails {
                    productId = product.id
                    name = product.title
                    unitPrice = product.priceCents / 100.0
                }
        }

    private fun logSharingResult(result: SharingResult) {
        when (result) {
            is SharingResult.Shared -> addLog("Reward link shared: ${result.link}", LogType.SUCCESS)
            is SharingResult.Copied -> addLog("Reward link copied to clipboard: ${result.link}", LogType.SUCCESS)
            SharingResult.InstallStarted -> addLog("Wallet install flow started by the sharing sheet.", LogType.INFO)
            SharingResult.WalletOpened -> addLog("Wallet opened directly; identity handed off.", LogType.SUCCESS)
            SharingResult.Dismissed -> addLog("Sharing sheet dismissed by user.", LogType.INFO)
            is SharingResult.Failed -> addLog("Sharing failed: ${result.error.message}", LogType.ERROR)
        }
    }

    /** The only place in the harness that calls `handleReferral` directly. */
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

    /** One `rewards.best` call for the whole visible catalog, not one per row. */
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

    /**
     * Every wiring fact the SDK can answer for, in one snapshot: the configured merchant id next
     * to the one the backend resolved, the identity events are attributed to, and the origins the
     * calls actually go to.
     */
    private suspend fun refreshDebugInfo(log: Boolean) {
        isDebugRefreshing = true
        val rows = mutableListOf<DebugRow>()
        rows += DebugRow("SDK version", FrakSdkVersion.CURRENT)
        rows += DebugRow("Configured merchant id", MERCHANT_ID)

        val client = Frak.clientOrNull
        if (client == null) {
            rows += DebugRow("Client", "not initialized")
            replaceDebugRows(rows)
            isDebugRefreshing = false
            if (log) addLog("SDK debug info: client not initialized.", LogType.ERROR)
            return
        }

        val environment = client.environment
        rows += DebugRow("Environment", environment::class.simpleName ?: "custom")
        rows += DebugRow("Wallet origin", environment.wallet)
        rows += DebugRow("Backend origin", environment.backend)
        rows += DebugRow("Wallet package id", environment.walletPackageId)
        rows += DebugRow("Wallet app installed", client.appLink.isFrakAppInstalled().toString())
        rows += DebugRow("Tracking enabled", client.isTrackingEnabled().toString())
        rows += DebugRow("Anonymous id", client.anonymousId() ?: "none (tracking off or key refused)")

        try {
            val resolved = client.config.resolve()
            rows += DebugRow("Resolved merchant id", resolved.merchantId)
            rows += DebugRow("Merchant name", resolved.displayName)
            rows += DebugRow("Merchant domain", resolved.domain)
            rows += DebugRow("Currency", resolved.currency?.wireValue ?: "unset")
            rows += DebugRow("Language", resolved.lang?.wireValue ?: "unset")
            val placements = resolved.sdkConfig?.placements.orEmpty()
            rows += DebugRow("Configured placements", placements.keys.joinToString().ifEmpty { "none" })
        } catch (error: FrakError) {
            rows += DebugRow("Resolved config", "failed: ${error.message}")
        }

        replaceDebugRows(rows)
        isDebugRefreshing = false
        if (log) addLog("SDK debug info refreshed (${rows.size} fields).", LogType.SUCCESS)
    }

    private fun replaceDebugRows(rows: List<DebugRow>) {
        debugRows.clear()
        debugRows.addAll(rows)
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
    debugRows: List<DebugRow>,
    isDebugRefreshing: Boolean,
    onShareStore: () -> Unit,
    onShareProduct: (ProductItem) -> Unit,
    onShareCollection: () -> Unit,
    onSimulateDeepLink: () -> Unit,
    onOrderCompleted: () -> Unit,
    onRefreshDebugInfo: () -> Unit,
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
                    onShareStore = onShareStore,
                    onShareProduct = onShareProduct,
                    onShareCollection = onShareCollection,
                )
            } else {
                CheckoutToolsView(
                    debugRows = debugRows,
                    isDebugRefreshing = isDebugRefreshing,
                    onSimulateDeepLink = onSimulateDeepLink,
                    onOrderCompleted = onOrderCompleted,
                    onRefreshDebugInfo = onRefreshDebugInfo,
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
    onShareStore: () -> Unit,
    onShareProduct: (ProductItem) -> Unit,
    onShareCollection: () -> Unit,
) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // One headline card for the whole catalog, not one per row.
        item {
            CatalogRewardBanner(label = catalogRewardLabel)
        }
        item {
            ShareScopeCard(
                title = "Share the store",
                subtitle = "No product scope: no products and no link, so the sheet falls back to the homepage.",
                buttonLabel = "Share Store (no product)",
                onClick = onShareStore,
            )
        }
        item {
            ShareScopeCard(
                title = "Share the collection",
                subtitle = "${products.size} products, each with an image — the sheet renders one card per product.",
                buttonLabel = "Share Collection (${products.size} products)",
                onClick = onShareCollection,
            )
        }
        items(products) { product ->
            ProductCard(product = product, onShareProduct = onShareProduct)
        }
    }
}

/** The single headline reward figure for the entire visible catalog. */
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

/** The store-wide and collection-wide share entry points; product rows have their own button. */
@Composable
private fun ShareScopeCard(
    title: String,
    subtitle: String,
    buttonLabel: String,
    onClick: () -> Unit,
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
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = FrakTheme.textPrimary,
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = FrakTheme.textSecondary,
            )
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
                Text(buttonLabel)
            }
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
            Text(
                text = "${formatCents(product.priceCents)} · ${product.id}",
                style = MaterialTheme.typography.bodySmall,
                color = FrakTheme.textSecondary,
            )
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = { onShareProduct(product) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Share This Product")
            }
        }
    }
}

@Composable
fun CheckoutToolsView(
    debugRows: List<DebugRow>,
    isDebugRefreshing: Boolean,
    onSimulateDeepLink: () -> Unit,
    onOrderCompleted: () -> Unit,
    onRefreshDebugInfo: () -> Unit,
) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        item {
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
        }

        item {
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

        item {
            SdkDebugCard(
                rows = debugRows,
                isRefreshing = isDebugRefreshing,
                onRefresh = onRefreshDebugInfo,
            )
        }
    }
}

/** Everything the SDK reports about this install, for checking the wiring on a real device. */
@Composable
private fun SdkDebugCard(
    rows: List<DebugRow>,
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
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
                text = "SDK Debug Info",
                style = MaterialTheme.typography.titleMedium,
                color = FrakTheme.textPrimary,
            )
            Text(
                text = "Read back from the live client — identity, merchant and origins.",
                style = MaterialTheme.typography.bodySmall,
                color = FrakTheme.textSecondary,
            )
            Spacer(modifier = Modifier.height(8.dp))

            if (rows.isEmpty()) {
                Text(
                    text = "Loading…",
                    style = MaterialTheme.typography.bodySmall,
                    color = FrakTheme.textSecondary,
                )
            }
            rows.forEach { row ->
                Row(modifier = Modifier.padding(vertical = 2.dp)) {
                    Text(
                        text = "${row.label}: ",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        color = FrakTheme.textSecondary,
                    )
                    Text(
                        text = row.value,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp,
                        color = FrakTheme.textPrimary,
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(
                onClick = onRefresh,
                enabled = !isRefreshing,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (isRefreshing) "Refreshing…" else "Refresh SDK Info")
            }
        }
    }
}
