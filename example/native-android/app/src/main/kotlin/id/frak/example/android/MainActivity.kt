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
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.frak.example.android.sdk.DeepLinkHandling
import id.frak.example.android.sdk.FrakClient
import id.frak.example.android.sdk.FrakConfig
import id.frak.example.android.sdk.ProductItem
import id.frak.example.android.sdk.PurchaseDetails
import id.frak.example.android.sdk.SharingRequest
import id.frak.example.android.sdk.SharingResult
import id.frak.example.android.ui.FrakColorScheme
import id.frak.example.android.ui.FrakTheme
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
 * Shared with the iOS harness — same ids, titles and reward amounts, so a
 * divergence between the two apps is visible in review.
 */
val sampleProducts =
    listOf(
        ProductItem(
            id = "prod_001",
            title = "Babies camel cuir velours bout carré",
            link = "https://example.com/product-1",
            estimatedRewardCents = 1500,
        ),
        ProductItem(
            id = "prod_002",
            title = "Sneakers blanches classiques",
            link = "https://example.com/product-2",
            estimatedRewardCents = 1250,
        ),
        ProductItem(
            id = "prod_003",
            title = "Boots en cuir noir",
            link = "https://example.com/product-3",
            estimatedRewardCents = 2000,
        ),
    )

/** Order total used by the checkout simulator, shared with the iOS harness. */
const val SAMPLE_ORDER_TOTAL_CENTS = 14999L

/** Hoisted: allocating a formatter per log line is wasteful and this runs often. */
private val LOG_TIME_FORMAT = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

/**
 * Display-only formatting, local to the harness.
 *
 * The real SDK formats rewards server-side; this exists so the two example apps
 * render identical strings and a divergence shows up in review. Deliberately
 * not `NumberFormat.getCurrencyInstance()`: Android and iOS emit different
 * output for identical locale and currency input (`"CHF 10.00"` vs
 * `"CHF10.00"`).
 */
fun formatCents(cents: Long): String = "$%d.%02d".format(cents / 100, cents % 100)

class MainActivity : ComponentActivity() {
    private val logs = mutableStateListOf<LogEntry>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize Frak SDK
        FrakClient.shared.initialize(
            context = applicationContext,
            config =
                FrakConfig(
                    merchantId = "merchant_example_android_123",
                    deepLink = DeepLinkHandling.Automatic,
                ),
        )

        addLog("SDK initialized for merchant_example_android_123", LogType.INFO)

        intent?.dataString?.let { url ->
            handleIncomingUrl(url)
        }

        setContent {
            MaterialTheme(colorScheme = FrakColorScheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    MerchantAppScreen(
                        logs = logs,
                        onShareProduct = { product ->
                            handleShare(product)
                        },
                        onSimulateDeepLink = {
                            val testUrl = "https://example-merchant.com/product?fCtx=test_referral_token_9988"
                            handleIncomingUrl(testUrl)
                        },
                        onOrderCompleted = {
                            handleOrderCompleted()
                        },
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.dataString?.let { url ->
            handleIncomingUrl(url)
        }
    }

    /**
     * The intent filter and the cold/warm-start wiring are the real thing and
     * are what this path exercises. The URL itself is only logged — parsing
     * `fCtx` is the SDK's job and the SDK does not exist yet.
     */
    private fun handleIncomingUrl(url: String) {
        FrakClient.shared.handleReferralLink(url)
        addLog("Inbound link reached the activity: $url", LogType.SUCCESS)
    }

    private fun handleShare(product: ProductItem) {
        addLog("Triggering sharing page for '${product.title}'...", LogType.INFO)
        val request =
            SharingRequest(
                productId = product.id,
                productName = product.title,
                estimatedRewardCents = product.estimatedRewardCents,
                products = listOf(product),
            )
        FrakClient.shared.presentSharing(request) { result ->
            when (result) {
                is SharingResult.Shared -> {
                    addLog("Reward link shared successfully!", LogType.SUCCESS)
                }

                is SharingResult.Copied -> {
                    addLog("Reward link copied to clipboard!", LogType.SUCCESS)
                }

                is SharingResult.Installed -> {
                    addLog("Wallet install flow triggered!", LogType.INFO)
                }

                is SharingResult.Dismissed -> {
                    addLog("Sharing sheet dismissed by user.", LogType.INFO)
                }

                is SharingResult.Failed -> {
                    addLog("Sharing failed: ${result.error}", LogType.ERROR)
                }
            }
        }
    }

    private fun handleOrderCompleted() {
        val orderId = "ord_${System.currentTimeMillis()}"
        val purchase =
            PurchaseDetails(
                orderId = orderId,
                amountInCents = SAMPLE_ORDER_TOTAL_CENTS,
            )
        FrakClient.shared.trackPurchase(purchase)
        addLog(
            "Order $orderId (${formatCents(SAMPLE_ORDER_TOTAL_CENTS)}) handed to the SDK — not tracked, no SDK",
            LogType.INFO,
        )
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
                text = "No SDK is wired up — every call below logs and returns.",
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
                ProductList(products = sampleProducts, onShareProduct = onShareProduct)
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
    onShareProduct: (ProductItem) -> Unit,
) {
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(products) { product ->
            val reward = formatCents(product.estimatedRewardCents)
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
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Estimated Reward: $reward",
                        style = MaterialTheme.typography.bodySmall,
                        color = FrakTheme.textAction,
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = { onShareProduct(product) },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Share & Earn $reward")
                    }
                }
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
