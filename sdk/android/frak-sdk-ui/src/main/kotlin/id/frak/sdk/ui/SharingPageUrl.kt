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
            if (confirmed) append("&confirmed=1")
        }

    /** What the page navigates to when it has something to report. */
    const val RESULT_HOST: String = "result"

    private const val MAX_SCHEME_SUFFIX = 60
}
