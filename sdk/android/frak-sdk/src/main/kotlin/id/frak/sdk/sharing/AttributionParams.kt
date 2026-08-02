package id.frak.sdk.sharing

import id.frak.sdk.config.AttributionDefaults

/**
 * Per-call attribution overrides for a share link's UTM parameters, merged over the
 * merchant-level [AttributionDefaults] field by field. Not a `data class`, see note in
 * `id.frak.sdk.core.FrakConfig`.
 */
public class AttributionParams(
    public val utmSource: String? = null,
    public val utmMedium: String? = null,
    public val utmCampaign: String? = null,
    public val utmContent: String? = null,
    public val utmTerm: String? = null,
    public val via: String? = null,
    public val ref: String? = null,
) {
    override fun equals(other: Any?): Boolean =
        other is AttributionParams &&
            other.utmSource == utmSource &&
            other.utmMedium == utmMedium &&
            other.utmCampaign == utmCampaign &&
            other.utmContent == utmContent &&
            other.utmTerm == utmTerm &&
            other.via == via &&
            other.ref == ref

    override fun hashCode(): Int =
        listOf(utmSource, utmMedium, utmCampaign, utmContent, utmTerm, via, ref)
            .fold(0) { accumulator, value -> 31 * accumulator + (value?.hashCode() ?: 0) }

    override fun toString(): String =
        "AttributionParams(utmSource=$utmSource, utmMedium=$utmMedium, utmCampaign=$utmCampaign, " +
            "utmContent=$utmContent, utmTerm=$utmTerm, via=$via, ref=$ref)"
}

/** Priority per field: [perCall] over [defaults]. `utmContent` never comes from [defaults]. */
internal fun mergeAttribution(
    perCall: AttributionParams?,
    defaults: AttributionDefaults?,
    productUtmContent: String? = null,
): AttributionParams =
    AttributionParams(
        utmSource = perCall?.utmSource ?: defaults?.utmSource,
        utmMedium = perCall?.utmMedium ?: defaults?.utmMedium,
        utmCampaign = perCall?.utmCampaign ?: defaults?.utmCampaign,
        utmContent = productUtmContent?.takeIf { it.isNotEmpty() } ?: perCall?.utmContent,
        utmTerm = perCall?.utmTerm ?: defaults?.utmTerm,
        via = perCall?.via ?: defaults?.via,
        ref = perCall?.ref ?: defaults?.ref,
    )
