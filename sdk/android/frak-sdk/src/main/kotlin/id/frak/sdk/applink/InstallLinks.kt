// Opted in per file rather than module-wide, so tests still see the marker where a merchant would.
@file:OptIn(InternalFrakApi::class)

package id.frak.sdk.applink

import id.frak.sdk.InternalFrakApi
import id.frak.sdk.net.PercentEncoding
import id.frak.sdk.net.UrlQuery

/** The two URLs that link this installation's anonymous id to a Frak wallet. */
internal object InstallLinks {
    /**
     * `<scheme>://install?m=&a=&p=`. [installProof] rides as a search param, not a fragment: the
     * wallet's deep-link router empties the hash before `/install` renders.
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
     * Play Store listing with an install referrer carrying the same pair. The referrer is built as
     * text, not via [UrlQuery], since its own separators must not be re-encoded.
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
     * The wallet's hosted install page: shows the install code and the store link, unlike
     * [playStore] which is the store listing itself. The proof rides in the fragment so it never
     * reaches a server, and `embed=native` is the same marker `/sharing` reads. `clip=host` stops
     * the page writing the code too: both writes land, and a plain one arriving after this SDK's
     * `EXTRA_IS_SENSITIVE` write is the one the system previews.
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
            "$walletOrigin/install?embed=native&clip=host" +
                "&m=${PercentEncoding.encode(merchantId)}" +
                "&a=${PercentEncoding.encode(anonymousId)}" +
                "&returnScheme=${PercentEncoding.encode(returnScheme)}" +
                "&sid=${PercentEncoding.encode(sessionId)}"
        return if (proof == null) url else "$url#p=${PercentEncoding.encode(proof)}"
    }

    private const val PLAY_STORE_BASE = "https://play.google.com/store/apps/details"
}
