package id.frak.sdk.applink

import id.frak.sdk.net.PercentEncoding
import id.frak.sdk.net.UrlQuery

/** The two URLs that link this installation's anonymous id to a Frak wallet. */
internal object InstallLinks {
    /** `<scheme>://install?m=&a=`. Wallet performs `POST /user/identity/ensure`, which needs a wallet session. */
    fun deepLink(
        scheme: String,
        merchantId: String,
        anonymousId: String,
    ): String = "$scheme://install?m=${PercentEncoding.encode(merchantId)}&a=${PercentEncoding.encode(anonymousId)}"

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

    private const val PLAY_STORE_BASE = "https://play.google.com/store/apps/details"
}
