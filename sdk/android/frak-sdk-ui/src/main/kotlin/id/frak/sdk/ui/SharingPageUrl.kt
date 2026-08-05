package id.frak.sdk.ui

import id.frak.sdk.FrakSdkVersion
import id.frak.sdk.net.PercentEncoding

/**
 * The hosted `/sharing` URL the sheet's web view loads. Nothing crosses back through
 * JavaScript: state goes in as query params, comes out as an intercepted navigation
 * to [returnScheme]`://result`, so the web view keeps no bridge at all.
 */
internal object SharingPageUrl {
    /** Must match the wallet's `sanitizeReturnScheme` pattern `^frak-[a-z0-9._-]{1,60}$` or callbacks silently drop. */
    fun returnScheme(packageId: String): String {
        val sanitised =
            packageId
                .lowercase()
                .filter { it.isDigit() || it in 'a'..'z' || it in ".-_" }
                .take(MAX_SCHEME_SUFFIX)
        return "frak-" + sanitised.ifEmpty { "app" } // guards an id made entirely of rejected characters
    }

    @Suppress("LongParameterList")
    fun build(
        walletOrigin: String,
        merchantId: String,
        clientId: String,
        packageId: String,
        sessionId: String,
        appName: String? = null,
        logoUrl: String? = null,
        link: String? = null,
        /** Pre-serialised JSON array; the page's router parses search values as JSON. */
        products: String? = null,
        seededReward: String? = null,
        confirmed: Boolean = false,
        /**
         * Radius, in CSS px, the page should round its own top corners with. See
         * [SHEET_CORNER_RADIUS_DP] for why the native side stopped doing it.
         *
         * Null on any host that does not want it, which is every host but Android: a SwiftUI
         * `.sheet` already clips to the system radius, and a second arc inside that one reads as
         * a double corner. Absent means the page keeps whatever it does today.
         */
        cornerRadius: Int? = null,
    ): String =
        buildString {
            append(walletOrigin).append("/sharing?native=1")
            append("&merchantId=").append(PercentEncoding.encode(merchantId))
            append("&clientId=").append(PercentEncoding.encode(clientId))
            append("&returnScheme=").append(PercentEncoding.encode(returnScheme(packageId)))
            append("&sid=").append(PercentEncoding.encode(sessionId))
            append(
                '&',
            ).append(
                FrakSdkVersion.QUERY_PARAMETER_NAME,
            ).append('=')
                .append(PercentEncoding.encode(FrakSdkVersion.CURRENT))
            appName?.let { append("&appName=").append(PercentEncoding.encode(it)) }
            logoUrl?.let { append("&logoUrl=").append(PercentEncoding.encode(it)) }
            link?.let { append("&link=").append(PercentEncoding.encode(it)) }
            products?.let { append("&products=").append(PercentEncoding.encode(it)) }
            seededReward?.let { append("&r=").append(PercentEncoding.encode(it)) }
            cornerRadius?.let { append("&cornerRadius=").append(it) }
            if (confirmed) append("&confirmed=1")
        }

    /**
     * The URL a pooled view is warmed on: everything knowable before the user taps.
     *
     * Unlike a neutral warm-up this carries the real `merchantId` and `clientId`, so the page
     * boots its bundle, i18n and both merchant-keyed queries while the user is still looking at
     * the merchant's own screen. `preload=1` is what makes that safe — the page reports itself
     * as `sharing_page_preloaded` instead of `sharing_page_viewed`, so warming surfaces nobody
     * opens cannot inflate the sharing funnel's denominator.
     *
     * What is missing is exactly [activationFragment]'s job.
     */
    fun warm(
        walletOrigin: String,
        merchantId: String,
        clientId: String,
        packageId: String,
        appName: String? = null,
        logoUrl: String? = null,
        /** See [build]'s own `cornerRadius`. Must match it, or a warmed page cannot be activated. */
        cornerRadius: Int? = null,
    ): String =
        buildString {
            append(walletOrigin).append("/sharing?native=1&preload=1")
            append("&merchantId=").append(PercentEncoding.encode(merchantId))
            append("&clientId=").append(PercentEncoding.encode(clientId))
            append("&returnScheme=").append(PercentEncoding.encode(returnScheme(packageId)))
            append("&sid=").append(SharingWebViewBinding.WARM_SESSION_ID)
            append('&')
                .append(FrakSdkVersion.QUERY_PARAMETER_NAME)
                .append('=')
                .append(PercentEncoding.encode(FrakSdkVersion.CURRENT))
            appName?.let { append("&appName=").append(PercentEncoding.encode(it)) }
            logoUrl?.let { append("&logoUrl=").append(PercentEncoding.encode(it)) }
            cornerRadius?.let { append("&cornerRadius=").append(it) }
        }

    /**
     * The per-tap params, as a fragment to hang off a [warm] URL.
     *
     * A fragment change is a same-document navigation: no request, no remount, no React boot —
     * which is the whole point, since that boot measured ~300ms of tap-to-paint and is the last
     * large block the native side could not reach.
     *
     * Only keys with something to say are written. The page spreads this over the warm URL's own
     * params, so writing a key with an empty value would erase the merchant config value under
     * it rather than leave it alone.
     */
    fun activationFragment(
        sessionId: String,
        link: String? = null,
        products: String? = null,
        logoUrl: String? = null,
        seededReward: String? = null,
        confirmed: Boolean = false,
    ): String =
        buildString {
            append("#sid=").append(PercentEncoding.encode(sessionId))
            // Explicit, not implied: this is what turns the page from a warm-up into a view,
            // and the event it reports depends on it.
            append("&preload=0")
            link?.let { append("&link=").append(PercentEncoding.encode(it)) }
            products?.let { append("&products=").append(PercentEncoding.encode(it)) }
            // Only when the request overrode it; otherwise the warm URL's config value stands.
            logoUrl?.let { append("&logoUrl=").append(PercentEncoding.encode(it)) }
            seededReward?.let { append("&r=").append(PercentEncoding.encode(it)) }
            if (confirmed) append("&confirmed=1")
        }

    /** What the page navigates to when it has something to report. */
    const val RESULT_HOST: String = "result"

    private const val MAX_SCHEME_SUFFIX = 60
}
