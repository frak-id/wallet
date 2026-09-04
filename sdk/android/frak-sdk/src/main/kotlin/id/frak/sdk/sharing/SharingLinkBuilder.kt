package id.frak.sdk.sharing

import id.frak.sdk.config.AttributionDefaults
import id.frak.sdk.net.UrlQuery

/** Builds a share link: merchant URL + `fCtx` + attribution params. 100% local, no network. */
internal object SharingLinkBuilder {
    /** The parameter every share link carries the referral context in. */
    const val CONTEXT_KEY: String = "fCtx"

    /** `utm_source` when nothing else supplies one, matching `frakContext.ts`. */
    private const val DEFAULT_SOURCE = "frak"

    /** Null when [baseUrl] isn't an http(s) URL, or context can't be encoded (no identity to build from). */
    fun build(
        baseUrl: String,
        context: FrakContext.V2,
        attribution: AttributionParams?,
        defaults: AttributionDefaults?,
        productUtmContent: String? = null,
    ): String? {
        // Scheme-checked, not just parseable: `UrlQuery` accepts any `scheme://`, and a share
        // link is handed to the OS chooser — `intent://` or a vendor scheme would resolve there.
        if (!isWebUrl(baseUrl)) return null
        val url = UrlQuery.parse(baseUrl) ?: return null
        val encoded = FrakContextCodec.compress(context) ?: return null
        val resolved = mergeAttribution(attribution, defaults, productUtmContent)

        return url
            .set(CONTEXT_KEY, encoded)
            // Gap-fill: never overwrite a parameter already on the merchant's own URL.
            .fillIfAbsent("utm_source", resolved.utmSource ?: DEFAULT_SOURCE)
            .fillIfAbsent("utm_medium", resolved.utmMedium)
            .fillIfAbsent("utm_campaign", resolved.utmCampaign)
            .fillIfAbsent("utm_content", resolved.utmContent)
            .fillIfAbsent("utm_term", resolved.utmTerm)
            .fillIfAbsent("via", resolved.via)
            .fillIfAbsent("ref", resolved.ref)
            .toString()
    }

    private fun isWebUrl(url: String): Boolean =
        url.startsWith("https://", ignoreCase = true) || url.startsWith("http://", ignoreCase = true)

    /** Reads the referral context out of an inbound URL, or null when it carries none. */
    fun parse(url: String): FrakContext? = UrlQuery.parse(url)?.get(CONTEXT_KEY)?.let(FrakContextCodec::decompress)
}
