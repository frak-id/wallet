package id.frak.example.android

import android.content.Context
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.pm.PackageInfoCompat
import id.frak.sdk.Frak
import id.frak.sdk.FrakSdkVersion
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakResult
import id.frak.sdk.core.ProductDetails
import id.frak.sdk.rewards.RewardRequest
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.ui.FrakSharing
import id.frak.sdk.ui.SharingResult
import java.util.Date

/** Distinct from the SDK tags (Frak, FrakSharing) so a run can separate app from SDK. */
private const val HARNESS_TAG: String = "FrakHarness"

/** Bounded so a long test session cannot grow the log without limit. */
private const val MAX_LOG_ENTRIES = 300

/** Every SDK call the harness makes, plus the state the three tabs render. */
class HarnessModel(
    private val appContext: Context,
    private val sharing: FrakSharing,
    val activeEnvironment: HarnessEnvironment,
) {
    val logs = mutableStateListOf<LogEntry>()
    val debugRows = mutableStateListOf<DebugRow>()

    var catalogReward by mutableStateOf<CatalogRewardLookup>(CatalogRewardLookup.Loading)
        private set
    var sdkState by mutableStateOf<SdkState>(SdkState.Checking)
        private set
    var walletInstalled by mutableStateOf<Boolean?>(null)
        private set
    var currencyCode by mutableStateOf(FALLBACK_CURRENCY_CODE)
        private set
    var isDebugRefreshing by mutableStateOf(false)
        private set
    var selectedEnvironment by mutableStateOf(activeEnvironment)
        private set

    val buildLabel: String =
        runCatching {
            val info = appContext.packageManager.getPackageInfo(appContext.packageName, 0)
            "${info.versionName} (${PackageInfoCompat.getLongVersionCode(info)})"
        }.getOrDefault("unknown")

    val logExport: String get() = logs.asReversed().joinToString("\n") { it.exportLine }

    val debugExport: String get() = debugRows.joinToString("\n") { "${it.label}: ${it.value}" }

    suspend fun start() {
        addLog(
            "Frak.initialize called for merchant ${activeEnvironment.merchantId} " +
                "(${activeEnvironment.label})",
            LogType.INFO,
        )
        val installed = Frak.client.appLink.isFrakAppInstalled()
        walletInstalled = installed
        addLog("Frak wallet app installed: $installed", LogType.INFO)
        resolveConfig()
        loadCatalogReward()
        refreshDebugInfo(log = false)
    }

    /**
     * Persists only. Switching in place would leave the sharing sheet's pooled web view on the
     * previous stage's wallet origin, and re-initializing double-registers the deep-link observer.
     */
    fun selectEnvironment(environment: HarnessEnvironment) {
        selectedEnvironment = environment
        HarnessEnvironmentStore.write(appContext, environment)
        if (environment == activeEnvironment) {
            addLog("Environment stays ${environment.label} on the next launch.", LogType.INFO)
            return
        }
        addLog("Environment set to ${environment.label}. Restart the app to apply it.", LogType.INFO)
    }

    /** Share #1: no products at all — the link falls back to the merchant homepage. */
    fun shareStore() {
        addLog("Opening the share sheet for the whole store...", LogType.INFO)
        sharing.present(
            SharingRequest {
                targetInteraction = "purchase"
                placement = "home"
            },
        )
    }

    /** Share #2: exactly one product, scoped and illustrated. */
    fun shareProduct(product: ProductItem) {
        addLog("Opening the share sheet for '${product.title}'...", LogType.INFO)
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
    fun shareCollection() {
        addLog("Opening the share sheet for ${sampleProducts.size} products...", LogType.INFO)
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

    fun logSharingResult(result: SharingResult) {
        when (result) {
            // Android cannot see what the user picked: NativeShare returns startActivity().isSuccess,
            // so this fires when the chooser opens.
            is SharingResult.Shared -> addLog("Share chooser opened for: ${result.link}", LogType.INFO)

            is SharingResult.Copied -> addLog("Reward link copied to clipboard: ${result.link}", LogType.SUCCESS)

            SharingResult.InstallStarted -> addLog("Wallet install flow started by the sharing sheet.", LogType.INFO)

            SharingResult.WalletOpened -> addLog("Wallet opened directly; identity handed off.", LogType.SUCCESS)

            SharingResult.Dismissed -> addLog("Sharing sheet dismissed by user.", LogType.INFO)

            is SharingResult.Failed -> addLog("Sharing failed: ${result.error.message}", LogType.ERROR)
        }
    }

    /**
     * Reports arrival at the activity, which is all this callback can honestly observe. Whether the
     * SDK tracked it is a separate question that only Debug info answers, so this is not a SUCCESS.
     */
    fun logInboundIntent(url: String) {
        addLog("Inbound link reached the app: $url", LogType.INFO)
        addLog("Open Debug to confirm the SDK picked up the referral.", LogType.INFO)
    }

    /** The only place in the harness that calls `handleReferral` directly. */
    suspend fun simulateDeepLink() {
        val testUrl = "https://example-merchant.com/product?fCtx=test_referral_token_android_9988"
        addLog("Simulating an inbound referral link...", LogType.INFO)
        try {
            val handled = Frak.client.appLink.handleReferral(testUrl)
            addLog(
                if (handled) {
                    "Referral recognized — this visit is attributed to the sharer."
                } else {
                    "That link carried no Frak referral."
                },
                if (handled) LogType.SUCCESS else LogType.INFO,
            )
        } catch (error: FrakError) {
            addLog("appLink.handleReferral(...) failed: ${error.message}", LogType.ERROR)
        }
    }

    suspend fun completeOrder() {
        val orderId = "ord_${System.currentTimeMillis()}"
        addLog("Completing order $orderId (${formatCents(SAMPLE_ORDER_TOTAL_CENTS, currencyCode)})...", LogType.INFO)
        when (
            val result =
                Frak.client.tracking.purchase(
                    customerId = SAMPLE_CUSTOMER_ID,
                    orderId = orderId,
                    token = SAMPLE_CHECKOUT_TOKEN,
                )
        ) {
            is FrakResult.Success -> addLog("Order $orderId sent to Frak.", LogType.SUCCESS)
            is FrakResult.Failure -> addLog("Order $orderId tracking failed: ${result.error.message}", LogType.ERROR)
        }
    }

    fun clearLogs() {
        logs.clear()
        addLog("Log cleared.", LogType.INFO)
    }

    private suspend fun resolveConfig() {
        try {
            val resolved = Frak.client.config.resolve()
            currencyCode = resolved.currency?.wireValue ?: FALLBACK_CURRENCY_CODE
            sdkState = SdkState.Connected
            addLog("Merchant config resolved: ${resolved.name} (${resolved.domain})", LogType.SUCCESS)
        } catch (error: FrakError) {
            sdkState = SdkState.Failed(error.message.orEmpty())
            addLog("Config resolve failed: ${error.message}", LogType.ERROR)
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
    suspend fun refreshDebugInfo(log: Boolean) {
        isDebugRefreshing = true
        val rows = mutableListOf<DebugRow>()
        rows += DebugRow("App build", buildLabel)
        rows += DebugRow("SDK version", FrakSdkVersion.CURRENT)
        rows += DebugRow("Harness environment", activeEnvironment.label)
        rows += DebugRow("Configured merchant id", activeEnvironment.merchantId)

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

        val installed = client.appLink.isFrakAppInstalled()
        walletInstalled = installed
        rows += DebugRow("Wallet app installed", installed.toString())
        rows += DebugRow("Tracking enabled", client.isTrackingEnabled().toString())
        rows += DebugRow("Anonymous id", client.anonymousId() ?: "none (tracking off or key refused)")

        try {
            val resolved = client.config.resolve()
            currencyCode = resolved.currency?.wireValue ?: FALLBACK_CURRENCY_CODE
            sdkState = SdkState.Connected
            rows += DebugRow("Resolved merchant id", resolved.merchantId)
            rows += DebugRow("Merchant name", resolved.displayName)
            rows += DebugRow("Merchant domain", resolved.domain)
            rows += DebugRow("Currency", resolved.currency?.wireValue ?: "unset")
            rows += DebugRow("Language", resolved.lang?.wireValue ?: "unset")
            val placements = resolved.sdkConfig?.placements.orEmpty()
            rows += DebugRow("Configured placements", placements.keys.joinToString().ifEmpty { "none" })
        } catch (error: FrakError) {
            sdkState = SdkState.Failed(error.message.orEmpty())
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

    fun addLog(
        message: String,
        type: LogType,
    ) {
        logs.add(0, LogEntry(LOG_TIME_FORMAT.format(Date()), message, type))
        if (logs.size > MAX_LOG_ENTRIES) {
            logs.removeRange(MAX_LOG_ENTRIES, logs.size)
        }
        // Mirrored so a device run is greppable from `adb logcat` instead of read off the screen.
        when (type) {
            LogType.ERROR -> Log.e(HARNESS_TAG, message)
            else -> Log.i(HARNESS_TAG, message)
        }
    }
}
