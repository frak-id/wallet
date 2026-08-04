package id.frak.example.android.sdk

import android.content.Context
import android.util.Log

/**
 * ⚠️ SCAFFOLDING — this is not the Frak Android SDK.
 *
 * The real SDK does not exist yet. This file exists only so the example app's
 * screens have a shape to compile against, and it deliberately implements
 * **nothing**: every call logs and returns.
 *
 * Earlier revisions prototyped anonymous-id persistence, `fCtx` parsing and the
 * self-referral guard here. That logic was removed rather than kept: it is real
 * SDK behaviour, it was written twice in two languages with nothing asserting
 * the two agreed, and none of it survives into the real SDK — which derives a
 * keypair rather than persisting a UUID, and whose invariants are pinned by the
 * shared golden-fixture corpus. Prototyping it in a harness that runs no
 * fixtures proved nothing and could only drift.
 *
 * What this app can still exercise is real: that the manifest intent filter
 * fires, that an inbound URL reaches the activity on cold and warm start, and
 * that the screens drive the loop through a public surface only.
 *
 * Delete this file once the real artifact ships.
 */

enum class DeepLinkHandling {
    Automatic,
    Manual,
    Disabled,
}

data class FrakConfig(
    val merchantId: String,
    val deepLink: DeepLinkHandling = DeepLinkHandling.Automatic,
    val environment: String = "production",
)

data class ProductItem(
    val id: String,
    val title: String,
    val link: String,
    val estimatedRewardCents: Long,
)

data class SharingRequest(
    val productId: String,
    val productName: String,
    val estimatedRewardCents: Long,
    val products: List<ProductItem> = emptyList(),
)

sealed class SharingResult {
    data object Shared : SharingResult()

    data object Copied : SharingResult()

    data object Installed : SharingResult()

    data object Dismissed : SharingResult()

    data class Failed(
        val error: FrakError,
    ) : SharingResult()
}

sealed class FrakError : Throwable() {
    data object AlreadyPresenting : FrakError()

    data object NetworkError : FrakError()

    data class Unknown(
        override val message: String,
    ) : FrakError()
}

/**
 * No `currency` field: the harness renders a hardcoded `$` and the sample data is
 * not USD, so carrying one here would only assert something untrue. Currency comes
 * from the real SDK's static config.
 */
data class PurchaseDetails(
    val orderId: String,
    val amountInCents: Long,
)

class FrakClient private constructor() {
    companion object {
        val shared = FrakClient()

        private const val TAG = "FrakSDK"
        private const val NOT_IMPLEMENTED = "no SDK: sdk/android does not exist yet"
    }

    /**
     * [context] is unused but kept: the real SDK needs an application context,
     * and the point of this file is to hold the shape a merchant will call.
     */
    @Suppress("UNUSED_PARAMETER")
    fun initialize(
        context: Context,
        config: FrakConfig,
    ) {
        Log.d(TAG, "initialize(merchantId=${config.merchantId}) — $NOT_IMPLEMENTED")
    }

    /**
     * The real SDK presents a native sheet hosting `/sharing?native=1` and
     * resolves on the `?confirmed=1` return channel. Nothing is presented here,
     * so the result is a failure rather than a fabricated success — a harness
     * reporting "shared successfully" without a sheet is worse than one that
     * reports the truth.
     */
    fun presentSharing(
        request: SharingRequest,
        onResult: (SharingResult) -> Unit,
    ) {
        Log.d(TAG, "presentSharing(productId=${request.productId}) — $NOT_IMPLEMENTED")
        onResult(SharingResult.Failed(FrakError.Unknown(NOT_IMPLEMENTED)))
    }

    fun trackPurchase(details: PurchaseDetails) {
        Log.d(TAG, "trackPurchase(orderId=${details.orderId}) — $NOT_IMPLEMENTED")
    }

    /**
     * The real SDK parses `fCtx` case-insensitively, decodes the v2 binary
     * payload and applies the self-referral guard. None of that happens here,
     * so the URL is logged verbatim and nothing is returned.
     */
    fun handleReferralLink(url: String) {
        Log.d(TAG, "handleReferralLink($url) — $NOT_IMPLEMENTED")
    }
}
