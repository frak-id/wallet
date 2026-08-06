// Opted in for `PercentEncoding` per file, not module-wide, so the marker still bites elsewhere.
@file:OptIn(InternalFrakApi::class)

package id.frak.sdk.ui

import id.frak.sdk.FrakSdkVersion
import id.frak.sdk.InternalFrakApi
import id.frak.sdk.net.PercentEncoding

/**
 * The hosted `/sharing` URL the sheet's web view loads. State goes in as query params and comes
 * back out as an intercepted navigation to [returnScheme]`://result`, so there is no JS bridge.
 */
internal object SharingPageUrl {
    /** Must match the wallet's `sanitizeReturnScheme` pattern `^frak-[a-z0-9._-]{1,60}$` or callbacks silently drop. */
    fun returnScheme(packageId: String): String {
        val sanitised =
            packageId
                .lowercase()
                .filter { it.isDigit() || it in 'a'..'z' || it in ".-_" }
                .take(MAX_SCHEME_SUFFIX)
        return "frak-" + sanitised.ifEmpty { "app" } // Guards an id made entirely of rejected characters.
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
        // No presentation params: the sheet's chrome is injected per web view by [SharingHostStyle].
    ): String =
        buildString {
            append(walletOrigin).append("/sharing?embed=native")
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
            seededReward?.let { append("&seedReward=").append(PercentEncoding.encode(it)) }
            if (confirmed) append("&view=confirmation")
        }

    /**
     * The URL a pooled view is warmed on: everything knowable before the user taps. `state=warm`
     * makes the page report `sharing_page_preloaded` rather than `sharing_page_viewed`.
     */
    fun warm(
        walletOrigin: String,
        merchantId: String,
        clientId: String,
        packageId: String,
        appName: String? = null,
        logoUrl: String? = null,
    ): String =
        buildString {
            append(walletOrigin).append("/sharing?embed=native&state=warm")
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
        }

    /**
     * The per-tap params, as a fragment to hang off a [warm] URL — a same-document navigation, so
     * the page is not remounted. Only keys with something to say are written: the page spreads this
     * over the warm URL's own params, so an empty value would erase the config value under it.
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
            // Turns the page from a warm-up into a view; the event it reports depends on it.
            append("&state=live")
            link?.let { append("&link=").append(PercentEncoding.encode(it)) }
            products?.let { append("&products=").append(PercentEncoding.encode(it)) }
            // Only when the request overrode it; otherwise the warm URL's config value stands.
            logoUrl?.let { append("&logoUrl=").append(PercentEncoding.encode(it)) }
            seededReward?.let { append("&seedReward=").append(PercentEncoding.encode(it)) }
            if (confirmed) append("&view=confirmation")
        }

    /** What the page navigates to when it has something to report. */
    const val RESULT_HOST: String = "result"

    private const val MAX_SCHEME_SUFFIX = 60
}
