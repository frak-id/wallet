package id.frak.sdk.applink

import id.frak.sdk.net.PercentEncoding
import id.frak.sdk.net.UrlQuery

/** The two URLs that link this installation's anonymous id to a Frak wallet. */
internal object InstallLinks {
    /**
     * `<scheme>://install?m=&a=&p=`. Wallet performs `POST /user/identity/ensure`, which needs a
     * wallet session.
     *
     * [installProof] rides as a search param, not the `#p=` fragment the hosted install page
     * uses. A fragment cannot survive this hop: the wallet's deep-link router calls `navigate`,
     * so `window.location.hash` is already empty by the time `/install` renders — its
     * `routeResolvers.install` forwards `?p=` for exactly that reason. The trade-off a fragment
     * buys (never sent to a server, never logged, never in a `Referer`) is not lost here
     * either, since a custom-scheme URL is handed to the OS and never leaves the device.
     */
    fun deepLink(
        scheme: String,
        merchantId: String,
        anonymousId: String,
        installProof: String? = null,
    ): String {
        val url =
            "$scheme://install?m=${PercentEncoding.encode(merchantId)}" +
                "&a=${PercentEncoding.encode(anonymousId)}"
        return if (installProof == null) url else "$url&p=${PercentEncoding.encode(installProof)}"
    }

    /**
     * Play Store listing with an install referrer carrying the same pair. Referrer is a
     * percent-encoded query string nested inside another, built as text (not [UrlQuery]) since
     * it's a value whose own separators must not be re-encoded.
     */
    fun playStore(
        packageId: String,
        merchantId: String,
        anonymousId: String,
        installProof: String? = null,
    ): String {
        val referrer =
            buildString {
                append("merchantId=").append(merchantId)
                append("&anonymousId=").append(anonymousId)
                if (installProof != null) append("&proof=").append(installProof)
            }
        return "$PLAY_STORE_BASE?id=$packageId&referrer=${PercentEncoding.encode(referrer)}"
    }

    /**
     * The wallet's hosted install page, which shows the install code and the store link.
     *
     * Distinct from [playStore], which is the store listing itself. This is the page the
     * sharing sheet navigates to, so the user never leaves the merchant app to reach it.
     *
     * The proof rides in the fragment, matching the wallet's own `buildInstallUrl`: a fragment
     * is never sent to a server, never logged and never in a `Referer`, and it survives here
     * because the sheet loads this URL directly rather than routing it through an in-app
     * navigation that would drop it.
     *
     * [returnScheme]/[sessionId] are what let the page hand the install code back, which the
     * SDK needs in order to put it on the clipboard marked sensitive. Both are query params and
     * the proof stays in the fragment, so the fragment remains last.
     */
    fun installPage(
        walletOrigin: String,
        merchantId: String,
        anonymousId: String,
        returnScheme: String,
        sessionId: String,
        proof: String?,
    ): String {
        val url =
            "$walletOrigin/install?m=${PercentEncoding.encode(merchantId)}" +
                "&a=${PercentEncoding.encode(anonymousId)}" +
                "&returnScheme=${PercentEncoding.encode(returnScheme)}" +
                "&sid=${PercentEncoding.encode(sessionId)}"
        return if (proof == null) url else "$url#p=${PercentEncoding.encode(proof)}"
    }

    private const val PLAY_STORE_BASE = "https://play.google.com/store/apps/details"
}
