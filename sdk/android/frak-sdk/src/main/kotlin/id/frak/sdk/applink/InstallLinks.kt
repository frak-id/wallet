// Opted in for `PercentEncoding`, which is `@InternalFrakApi`. Per file, not module-wide: a
// `-opt-in` compiler flag would silence the marker everywhere, including in tests written to
// prove what a merchant can actually reach.
@file:OptIn(InternalFrakApi::class)

package id.frak.sdk.applink

import id.frak.sdk.InternalFrakApi
import id.frak.sdk.net.PercentEncoding
import id.frak.sdk.net.UrlQuery

/** The two URLs that link this installation's anonymous id to a Frak wallet. */
internal object InstallLinks {
    /**
     * `<scheme>://install?m=&a=&p=`. Wallet performs `POST /user/identity/ensure`, which needs a
     * wallet session.
     *
     * [installProof] rides as a search param, not the `#p=` fragment the hosted install page
     * uses: the wallet's deep-link router calls `navigate`, which empties the hash before
     * `/install` renders, so the fragment cannot survive this hop.
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
     * The wallet's hosted install page: shows the install code and the store link. Distinct from
     * [playStore], which is the store listing itself.
     *
     * The proof rides in the fragment (never sent to a server, never logged, never in a
     * `Referer`), matching the wallet's own `buildInstallUrl`. [returnScheme]/[sessionId] let the
     * page hand the install code back to the SDK; both are query params, so the fragment stays
     * last.
     *
     * `embed=native` is the single marker that says "a host is presenting this page inside its own
     * sheet", and it is the same spelling `/sharing` uses. The two routes used to disagree —
     * `/sharing` read `embed`, `/install` inferred it from the presence of `returnScheme` — which
     * meant one page could render host-embedded while the other did not, in the same web view, one
     * navigation apart.
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
            "$walletOrigin/install?embed=native" +
                "&m=${PercentEncoding.encode(merchantId)}" +
                "&a=${PercentEncoding.encode(anonymousId)}" +
                "&returnScheme=${PercentEncoding.encode(returnScheme)}" +
                "&sid=${PercentEncoding.encode(sessionId)}"
        return if (proof == null) url else "$url#p=${PercentEncoding.encode(proof)}"
    }

    private const val PLAY_STORE_BASE = "https://play.google.com/store/apps/details"
}
