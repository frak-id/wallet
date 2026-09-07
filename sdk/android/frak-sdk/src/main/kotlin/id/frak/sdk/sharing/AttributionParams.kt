package id.frak.sdk.sharing

import id.frak.sdk.config.AttributionDefaults

/**
 * Per-call attribution overrides for a share link's UTM parameters, merged over the
 * merchant-level [AttributionDefaults] field by field. Build with [Builder], or
 * `AttributionParams { }` from Kotlin.
 */
public class AttributionParams internal constructor(
    public val utmSource: String?,
    public val utmMedium: String?,
    public val utmCampaign: String?,
    public val utmContent: String?,
    public val utmTerm: String?,
    public val via: String?,
    public val ref: String?,
) {
    public class Builder {
        public var utmSource: String? = null

        public var utmMedium: String? = null

        public var utmCampaign: String? = null

        public var utmContent: String? = null

        public var utmTerm: String? = null

        public var via: String? = null

        public var ref: String? = null

        public fun utmSource(utmSource: String?): Builder = apply { this.utmSource = utmSource }

        public fun utmMedium(utmMedium: String?): Builder = apply { this.utmMedium = utmMedium }

        public fun utmCampaign(utmCampaign: String?): Builder = apply { this.utmCampaign = utmCampaign }

        public fun utmContent(utmContent: String?): Builder = apply { this.utmContent = utmContent }

        public fun utmTerm(utmTerm: String?): Builder = apply { this.utmTerm = utmTerm }

        public fun via(via: String?): Builder = apply { this.via = via }

        public fun ref(ref: String?): Builder = apply { this.ref = ref }

        public fun build(): AttributionParams =
            AttributionParams(utmSource, utmMedium, utmCampaign, utmContent, utmTerm, via, ref)
    }

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

/** Kotlin sugar over [AttributionParams.Builder]. */
public fun AttributionParams(configure: AttributionParams.Builder.() -> Unit): AttributionParams =
    AttributionParams.Builder().apply(configure).build()

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
