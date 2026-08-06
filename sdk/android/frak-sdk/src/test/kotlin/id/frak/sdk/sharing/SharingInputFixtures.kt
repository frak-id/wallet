package id.frak.sdk.sharing

/*
 * Defaulted helpers for the sharing input types and the two `FrakContext` layouts. Same reasoning as
 * `core/CoreInputFixtures.kt`. `frakContextV1`/`frakContextV2` use the `internal` constructor, since
 * `FrakContext` is a read model with no Builder — it is decoded from a link, never built by a merchant.
 */

internal fun sharingRequest(
    link: String? = null,
    products: List<SharingProduct> = emptyList(),
    attribution: AttributionParams? = null,
    targetInteraction: String? = null,
    placement: String? = null,
    logoUrl: String? = null,
): SharingRequest =
    SharingRequest
        .Builder()
        .link(link)
        .products(products)
        .attribution(attribution)
        .targetInteraction(targetInteraction)
        .placement(placement)
        .logoUrl(logoUrl)
        .build()

internal fun attributionParams(
    utmSource: String? = null,
    utmMedium: String? = null,
    utmCampaign: String? = null,
    utmContent: String? = null,
    utmTerm: String? = null,
    via: String? = null,
    ref: String? = null,
): AttributionParams =
    AttributionParams
        .Builder()
        .utmSource(utmSource)
        .utmMedium(utmMedium)
        .utmCampaign(utmCampaign)
        .utmContent(utmContent)
        .utmTerm(utmTerm)
        .via(via)
        .ref(ref)
        .build()

internal fun frakContextV1(wallet: String): FrakContext.V1 = FrakContext.V1(wallet)

internal fun frakContextV2(
    merchantId: String,
    timestamp: Long,
    clientId: String? = null,
    wallet: String? = null,
): FrakContext.V2 = FrakContext.V2(merchantId, timestamp, clientId, wallet)
