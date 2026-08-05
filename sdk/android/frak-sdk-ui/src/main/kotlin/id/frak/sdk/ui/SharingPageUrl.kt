// Opted in for `PercentEncoding`, which is `@InternalFrakApi`. Per file, not module-wide: a
// `-opt-in` compiler flag would silence the marker everywhere, including in tests written to
// prove what a merchant can actually reach.
@file:OptIn(InternalFrakApi::class)

package id.frak.sdk.ui

import id.frak.sdk.FrakSdkVersion
import id.frak.sdk.InternalFrakApi
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
        // No presentation params here. How the sheet looks is injected once per web view by
        // [SharingHostStyle], which is scoped to the wallet origin rather than to this route — so
        // the `/install` page the install CTA navigates to gets the same treatment for free, and
        // there is nothing for [warm] to keep byte-identical.
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
     * The URL a pooled view is warmed on: everything knowable before the user taps.
     *
     * Unlike a neutral warm-up this carries the real `merchantId` and `clientId`, so the page
     * boots its bundle, i18n and both merchant-keyed queries while the user is still looking at
     * the merchant's own screen. `state=warm` is what makes that safe — the page reports itself
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
