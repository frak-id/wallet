package id.frak.sdk.config

import id.frak.sdk.core.FrakCurrency
import id.frak.sdk.core.FrakLanguage
import id.frak.sdk.net.JsonReader
import org.json.JSONObject

/**
 * Turns a `GET /user/merchant/resolve` body into a [FrakResolvedConfig].
 *
 * A hand-written mapper, not reflective binding: avoids a serialization dependency. Everything
 * optional degrades to null; only the fields the OpenAPI document marks `required` are enforced.
 */
internal object ResolvedConfigDecoder {
    private const val CONTEXT = "merchant/resolve response"

    fun decode(body: String): FrakResolvedConfig {
        val root = JsonReader.parseObject(body)
        val sdkConfig = JsonReader.obj(root, "sdkConfig")?.let(::decodeSdkConfig)
        return FrakResolvedConfig(
            merchantId = JsonReader.requireString(root, "merchantId", CONTEXT),
            name = JsonReader.requireString(root, "name", CONTEXT),
            domain = JsonReader.requireString(root, "domain", CONTEXT),
            lang = sdkConfig?.lang,
            currency = sdkConfig?.currency,
            hidden = sdkConfig?.hidden ?: false,
            sdkConfig = sdkConfig,
        )
    }

    private fun decodeSdkConfig(source: JSONObject): ResolvedSdkConfig =
        ResolvedSdkConfig(
            name = JsonReader.string(source, "name"),
            logoUrl = JsonReader.string(source, "logoUrl"),
            homepageLink = JsonReader.string(source, "homepageLink"),
            currency = currency(JsonReader.string(source, "currency")),
            lang = language(JsonReader.string(source, "lang")),
            // Only ever sent when true, so absent means false rather than unknown.
            hidden = JsonReader.boolean(source, "hidden") ?: false,
            translations = JsonReader.stringMap(source, "translations"),
            placements = JsonReader.objectMap(source, "placements", ::decodePlacement),
            components = JsonReader.obj(source, "components")?.let(::decodeComponents),
            attribution = JsonReader.obj(source, "attribution")?.let(::decodeAttribution),
        )

    private fun decodePlacement(source: JSONObject): ResolvedPlacement =
        ResolvedPlacement(
            components = JsonReader.obj(source, "components")?.let(::decodeComponents),
            targetInteraction = JsonReader.string(source, "targetInteraction"),
            translations = JsonReader.stringMap(source, "translations"),
        )

    private fun decodeComponents(source: JSONObject): ResolvedComponents =
        ResolvedComponents(
            buttonShare =
                JsonReader.obj(source, "buttonShare")?.let {
                    ButtonShareConfig(
                        text = JsonReader.string(it, "text"),
                        noRewardText = JsonReader.string(it, "noRewardText"),
                        clickAction = JsonReader.string(it, "clickAction"),
                    )
                },
            buttonWallet =
                JsonReader.obj(source, "buttonWallet")?.let {
                    ButtonWalletConfig(position = JsonReader.string(it, "position"))
                },
            openInApp =
                JsonReader.obj(source, "openInApp")?.let {
                    OpenInAppConfig(text = JsonReader.string(it, "text"))
                },
            postPurchase =
                JsonReader.obj(source, "postPurchase")?.let {
                    PostPurchaseConfig(
                        badgeText = JsonReader.string(it, "badgeText"),
                        refereeText = JsonReader.string(it, "refereeText"),
                        refereeNoRewardText = JsonReader.string(it, "refereeNoRewardText"),
                        referrerText = JsonReader.string(it, "referrerText"),
                        referrerNoRewardText = JsonReader.string(it, "referrerNoRewardText"),
                        ctaText = JsonReader.string(it, "ctaText"),
                        ctaNoRewardText = JsonReader.string(it, "ctaNoRewardText"),
                        imageUrl = JsonReader.string(it, "imageUrl"),
                    )
                },
            banner =
                JsonReader.obj(source, "banner")?.let {
                    BannerConfig(
                        referralTitle = JsonReader.string(it, "referralTitle"),
                        referralDescription = JsonReader.string(it, "referralDescription"),
                        referralCta = JsonReader.string(it, "referralCta"),
                        inappTitle = JsonReader.string(it, "inappTitle"),
                        inappDescription = JsonReader.string(it, "inappDescription"),
                        inappCta = JsonReader.string(it, "inappCta"),
                        imageUrl = JsonReader.string(it, "imageUrl"),
                    )
                },
        )

    private fun decodeAttribution(source: JSONObject): AttributionDefaults =
        AttributionDefaults(
            utmSource = JsonReader.string(source, "utmSource"),
            utmMedium = JsonReader.string(source, "utmMedium"),
            utmCampaign = JsonReader.string(source, "utmCampaign"),
            utmTerm = JsonReader.string(source, "utmTerm"),
            via = JsonReader.string(source, "via"),
            ref = JsonReader.string(source, "ref"),
        )

    /** An unrecognised wire value reads as null; never throws (forward compatibility). */
    private fun currency(wireValue: String?): FrakCurrency? =
        FrakCurrency.entries.firstOrNull { it.wireValue == wireValue }

    private fun language(wireValue: String?): FrakLanguage? =
        FrakLanguage.entries.firstOrNull { it.wireValue == wireValue }
}
