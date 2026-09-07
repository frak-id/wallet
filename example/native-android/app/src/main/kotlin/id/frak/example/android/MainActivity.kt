package id.frak.example.android

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.frak.example.android.ui.CheckoutTab
import id.frak.example.android.ui.DebugTab
import id.frak.example.android.ui.FrakColorScheme
import id.frak.example.android.ui.FrakTheme
import id.frak.example.android.ui.LogConsole
import id.frak.example.android.ui.ShopTab
import id.frak.example.android.ui.StatusStrip
import id.frak.sdk.Frak
import id.frak.sdk.FrakSdkVersion
import id.frak.sdk.core.DeepLinkHandling
import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakMetadata
import id.frak.sdk.ui.FrakSharing
import kotlinx.coroutines.launch
import kotlin.system.exitProcess

private val HARNESS_TABS = listOf("Shop", "Checkout", "Debug")

class MainActivity : ComponentActivity() {
    /**
     * Built in `onCreate` rather than as a property initialiser: `build(activity)` needs the
     * `ViewModelStore`, which does not exist that early.
     */
    private lateinit var sharing: FrakSharing

    private lateinit var model: HarnessModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Read before Frak.initialize; the picker in Debug only writes the next launch's value.
        val activeEnvironment = HarnessEnvironmentStore.read(this)

        sharing = FrakSharing.Builder { result -> model.logSharingResult(result) }.build(this)

        Frak.initialize(
            context = applicationContext,
            config =
                FrakConfig(merchantId = activeEnvironment.merchantId) {
                    metadata =
                        FrakMetadata {
                            name = "Frak Android Harness"
                            // Last fallback of the share link chain, so the unscoped share
                            // (no link, no products) still has something to link to.
                            homepageLink = STORE_LINK
                        }
                    // Each stage has its own wallet package id, so isFrakAppInstalled() only
                    // reports true for the wallet build matching this one.
                    env = activeEnvironment.frakEnvironment
                    // Automatic exists only on Android; iOS routes .onOpenURL by hand.
                    deepLink = DeepLinkHandling.Automatic
                    logLevel = FrakLogLevel.INFO
                },
        )

        model = HarnessModel(applicationContext, sharing, activeEnvironment)

        // Not the Compose build site, so warming has to be explicit. A merchant whose share
        // surface is several taps in should warm when that surface appears, not at startup.
        sharing.warm()

        intent?.dataString?.let { url -> model.logInboundIntent(url) }

        setContent {
            MaterialTheme(colorScheme = FrakColorScheme) {
                Surface(
                    // The activity draws edge to edge, so without this the
                    // title sits under the status bar and the log pane under
                    // the gesture bar. The sheet insets itself.
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .windowInsetsPadding(WindowInsets.safeDrawing),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    MerchantAppScreen(model = model, onRestartNow = ::restartProcess)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Android does not do this for you, and without it `activity.intent` returns the launch
        // intent forever — the stale read that hid the warm-start bug from every device pass.
        setIntent(intent)
        intent.dataString?.let { url -> model.logInboundIntent(url) }
    }

    /** The stage is read once at process start, so applying a new one means a new process. */
    private fun restartProcess() {
        val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return
        launch.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK or Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(launch)
        finishAffinity()
        exitProcess(0)
    }
}

@Composable
fun MerchantAppScreen(
    model: HarnessModel,
    onRestartNow: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var activeTab by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) { model.start() }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(16.dp),
    ) {
        Text(
            text = "Frak Demo Store",
            style = MaterialTheme.typography.headlineSmall,
            color = FrakTheme.textPrimary,
            modifier = Modifier.padding(bottom = 8.dp),
        )

        StatusStrip(
            environment = model.activeEnvironment,
            sdkState = model.sdkState,
            walletInstalled = model.walletInstalled,
            buildLabel = model.buildLabel,
            sdkVersion = FrakSdkVersion.CURRENT,
        )

        Spacer(modifier = Modifier.height(12.dp))

        PrimaryTabRow(selectedTabIndex = activeTab) {
            HARNESS_TABS.forEachIndexed { index, label ->
                Tab(selected = activeTab == index, onClick = { activeTab = index }) {
                    Text(label, modifier = Modifier.padding(10.dp))
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Box(modifier = Modifier.weight(1f)) {
            when (activeTab) {
                0 -> {
                    ShopTab(
                        products = sampleProducts,
                        catalogRewardLabel = model.catalogReward.label,
                        currencyCode = model.currencyCode,
                        onShareStore = model::shareStore,
                        onShareProduct = model::shareProduct,
                        onShareCollection = model::shareCollection,
                    )
                }

                1 -> {
                    CheckoutTab(
                        currencyCode = model.currencyCode,
                        onOrderCompleted = { scope.launch { model.completeOrder() } },
                        onSimulateDeepLink = { scope.launch { model.simulateDeepLink() } },
                    )
                }

                else -> {
                    DebugTab(
                        activeEnvironment = model.activeEnvironment,
                        selectedEnvironment = model.selectedEnvironment,
                        onSelectEnvironment = model::selectEnvironment,
                        onRestartNow = onRestartNow,
                        debugRows = model.debugRows,
                        debugExport = model.debugExport,
                        isDebugRefreshing = model.isDebugRefreshing,
                        onRefreshDebugInfo = { scope.launch { model.refreshDebugInfo(log = true) } },
                        onRunJavaInterop = model::runJavaInterop,
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        LogConsole(
            logs = model.logs,
            exportText = model.logExport,
            onClear = model::clearLogs,
        )
    }
}
