package id.frak.sdk.ui

import id.frak.sdk.Frak
import id.frak.sdk.core.FrakError

/**
 * Warms the identity and merchant config the sheet needs before it can build a page URL, then
 * answers that URL. Gated on [id.frak.sdk.core.FrakConfig.preloadSharing]. Answers a URL rather
 * than warming the pool itself because this can resume with no Activity attached, and a `WebView`
 * must be built against a windowed context — [SharingHost] holds the answer until it has one.
 */
internal suspend fun resolveWarmUrl(packageId: String): String? {
    if (!Frak.isInitialized) return null
    if (!Frak.preloadSharing) return null

    val trace = SharingTrace()
    val client = Frak.client
    val walletOrigin = client.environment.wallet

    // A warm-up that fails is not a failure: the sheet re-resolves. It must never throw either —
    // this runs on a scope with no exception handler between it and the merchant's process.
    val identity =
        try {
            // Already eager at initialize; awaiting only lands the sheet's read on a completed one.
            val clientId = client.anonymousId()
            trace.mark("warm identity ready")
            clientId to client.config.resolve().toSharingMerchant()
        } catch (unavailable: FrakError) {
            null
        }
    trace.mark("warm config ready")
    val clientId = identity?.first
    val merchant = identity?.second

    // Without both halves the page renders nothing; leave the view cold for the sheet's full load.
    if (merchant == null || clientId == null) return null

    return SharingPageUrl.warm(
        walletOrigin = walletOrigin,
        merchantId = merchant.merchantId,
        clientId = clientId,
        packageId = packageId,
        appName = merchant.displayName,
        logoUrl = merchant.logoUrl,
    )
}
