package id.frak.sdk.config

import id.frak.sdk.core.FrakCurrency
import id.frak.sdk.core.FrakLanguage

/**
 * What the backend knows about this merchant. The whole tree is `public` (not just fields this
 * increment uses) because its reader, the sharing sheet, lives in the separate `:frak-sdk-ui`
 * Gradle module and only sees `public` API. Not a `data class` anywhere in this tree: a published
 * `copy()`/`componentN()` would freeze the ABI against future fields, hence hand-written
 * `equals`/`hashCode`/`toString`. Deliberately absent: `css`, `productId`, `allowedDomains`
 * (no native equivalent).
 */
public class FrakResolvedConfig(
    public val merchantId: String,
    public val name: String,
    /** Merchant's canonical domain, not whatever domain was queried. */
    public val domain: String,
    /** Null when the backend sends a value this SDK's build does not recognise. */
    public val lang: FrakLanguage? = null,
    /** May differ from [id.frak.sdk.core.FrakMetadata.currency]; informational only, never used for formatting. */
    public val currency: FrakCurrency? = null,
    public val hidden: Boolean = false,
    public val sdkConfig: ResolvedSdkConfig? = null,
) {
    override fun toString(): String =
        "FrakResolvedConfig(merchantId=$merchantId, name=$name, domain=$domain, lang=$lang, " +
            "currency=$currency, hidden=$hidden, sdkConfig=$sdkConfig)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is FrakResolvedConfig) return false
        return merchantId == other.merchantId &&
            name == other.name &&
            domain == other.domain &&
            lang == other.lang &&
            currency == other.currency &&
            hidden == other.hidden &&
            sdkConfig == other.sdkConfig
    }

    override fun hashCode(): Int {
        var result = merchantId.hashCode()
        result = 31 * result + name.hashCode()
        result = 31 * result + domain.hashCode()
        result = 31 * result + (lang?.hashCode() ?: 0)
        result = 31 * result + (currency?.hashCode() ?: 0)
        result = 31 * result + hidden.hashCode()
        result = 31 * result + (sdkConfig?.hashCode() ?: 0)
        return result
    }
}

/** The `sdkConfig` block of the resolve response. Wire-shaped: every field defaults to absent. */
public class ResolvedSdkConfig(
    public val name: String? = null,
    public val logoUrl: String? = null,
    public val homepageLink: String? = null,
    public val currency: FrakCurrency? = null,
    public val lang: FrakLanguage? = null,
    public val hidden: Boolean = false,
    public val translations: Map<String, String> = emptyMap(),
    /** Tier 1 of the copy precedence. */
    public val placements: Map<String, ResolvedPlacement> = emptyMap(),
    /** Tier 2 of the copy precedence. */
    public val components: ResolvedComponents? = null,
    public val attribution: AttributionDefaults? = null,
) {
    override fun toString(): String =
        "ResolvedSdkConfig(name=$name, logoUrl=$logoUrl, homepageLink=$homepageLink, " +
            "currency=$currency, lang=$lang, hidden=$hidden, translations=$translations, " +
            "placements=$placements, components=$components, attribution=$attribution)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ResolvedSdkConfig) return false
        return name == other.name &&
            logoUrl == other.logoUrl &&
            homepageLink == other.homepageLink &&
            currency == other.currency &&
            lang == other.lang &&
            hidden == other.hidden &&
            translations == other.translations &&
            placements == other.placements &&
            components == other.components &&
            attribution == other.attribution
    }

    override fun hashCode(): Int {
        var result = name?.hashCode() ?: 0
        result = 31 * result + (logoUrl?.hashCode() ?: 0)
        result = 31 * result + (homepageLink?.hashCode() ?: 0)
        result = 31 * result + (currency?.hashCode() ?: 0)
        result = 31 * result + (lang?.hashCode() ?: 0)
        result = 31 * result + hidden.hashCode()
        result = 31 * result + translations.hashCode()
        result = 31 * result + placements.hashCode()
        result = 31 * result + (components?.hashCode() ?: 0)
        result = 31 * result + (attribution?.hashCode() ?: 0)
        return result
    }
}

/** One placement's overrides. Tier 1 of the copy precedence. */
public class ResolvedPlacement(
    public val components: ResolvedComponents? = null,
    public val targetInteraction: String? = null,
    public val translations: Map<String, String> = emptyMap(),
) {
    override fun toString(): String =
        "ResolvedPlacement(components=$components, targetInteraction=$targetInteraction, " +
            "translations=$translations)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ResolvedPlacement) return false
        return components == other.components &&
            targetInteraction == other.targetInteraction &&
            translations == other.translations
    }

    override fun hashCode(): Int {
        var result = components?.hashCode() ?: 0
        result = 31 * result + (targetInteraction?.hashCode() ?: 0)
        result = 31 * result + translations.hashCode()
        return result
    }
}

/** Every field nullable: absent means "fall through to the next tier", not "empty". */
public class ResolvedComponents(
    public val buttonShare: ButtonShareConfig? = null,
    public val buttonWallet: ButtonWalletConfig? = null,
    public val openInApp: OpenInAppConfig? = null,
    public val postPurchase: PostPurchaseConfig? = null,
    public val banner: BannerConfig? = null,
) {
    override fun toString(): String =
        "ResolvedComponents(buttonShare=$buttonShare, buttonWallet=$buttonWallet, " +
            "openInApp=$openInApp, postPurchase=$postPurchase, banner=$banner)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ResolvedComponents) return false
        return buttonShare == other.buttonShare &&
            buttonWallet == other.buttonWallet &&
            openInApp == other.openInApp &&
            postPurchase == other.postPurchase &&
            banner == other.banner
    }

    override fun hashCode(): Int {
        var result = buttonShare?.hashCode() ?: 0
        result = 31 * result + (buttonWallet?.hashCode() ?: 0)
        result = 31 * result + (openInApp?.hashCode() ?: 0)
        result = 31 * result + (postPurchase?.hashCode() ?: 0)
        result = 31 * result + (banner?.hashCode() ?: 0)
        return result
    }
}

public class ButtonShareConfig(
    public val text: String? = null,
    /** Copy for when there is no concrete reward to advertise (e.g. a percentage-only campaign). */
    public val noRewardText: String? = null,
    public val clickAction: String? = null,
) {
    override fun toString(): String =
        "ButtonShareConfig(text=$text, noRewardText=$noRewardText, clickAction=$clickAction)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ButtonShareConfig) return false
        return text == other.text &&
            noRewardText == other.noRewardText &&
            clickAction == other.clickAction
    }

    override fun hashCode(): Int {
        var result = text?.hashCode() ?: 0
        result = 31 * result + (noRewardText?.hashCode() ?: 0)
        result = 31 * result + (clickAction?.hashCode() ?: 0)
        return result
    }
}

public class ButtonWalletConfig(
    public val position: String? = null,
) {
    override fun toString(): String = "ButtonWalletConfig(position=$position)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ButtonWalletConfig) return false
        return position == other.position
    }

    override fun hashCode(): Int = position?.hashCode() ?: 0
}

public class OpenInAppConfig(
    public val text: String? = null,
) {
    override fun toString(): String = "OpenInAppConfig(text=$text)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is OpenInAppConfig) return false
        return text == other.text
    }

    override fun hashCode(): Int = text?.hashCode() ?: 0
}

public class PostPurchaseConfig(
    public val badgeText: String? = null,
    public val refereeText: String? = null,
    public val refereeNoRewardText: String? = null,
    public val referrerText: String? = null,
    public val referrerNoRewardText: String? = null,
    public val ctaText: String? = null,
    public val ctaNoRewardText: String? = null,
    public val imageUrl: String? = null,
) {
    override fun toString(): String =
        "PostPurchaseConfig(badgeText=$badgeText, refereeText=$refereeText, " +
            "refereeNoRewardText=$refereeNoRewardText, referrerText=$referrerText, " +
            "referrerNoRewardText=$referrerNoRewardText, ctaText=$ctaText, " +
            "ctaNoRewardText=$ctaNoRewardText, imageUrl=$imageUrl)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is PostPurchaseConfig) return false
        return badgeText == other.badgeText &&
            refereeText == other.refereeText &&
            refereeNoRewardText == other.refereeNoRewardText &&
            referrerText == other.referrerText &&
            referrerNoRewardText == other.referrerNoRewardText &&
            ctaText == other.ctaText &&
            ctaNoRewardText == other.ctaNoRewardText &&
            imageUrl == other.imageUrl
    }

    override fun hashCode(): Int {
        var result = badgeText?.hashCode() ?: 0
        result = 31 * result + (refereeText?.hashCode() ?: 0)
        result = 31 * result + (refereeNoRewardText?.hashCode() ?: 0)
        result = 31 * result + (referrerText?.hashCode() ?: 0)
        result = 31 * result + (referrerNoRewardText?.hashCode() ?: 0)
        result = 31 * result + (ctaText?.hashCode() ?: 0)
        result = 31 * result + (ctaNoRewardText?.hashCode() ?: 0)
        result = 31 * result + (imageUrl?.hashCode() ?: 0)
        return result
    }
}

public class BannerConfig(
    public val referralTitle: String? = null,
    public val referralDescription: String? = null,
    public val referralCta: String? = null,
    public val inappTitle: String? = null,
    public val inappDescription: String? = null,
    public val inappCta: String? = null,
    public val imageUrl: String? = null,
) {
    override fun toString(): String =
        "BannerConfig(referralTitle=$referralTitle, referralDescription=$referralDescription, " +
            "referralCta=$referralCta, inappTitle=$inappTitle, inappDescription=$inappDescription, " +
            "inappCta=$inappCta, imageUrl=$imageUrl)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is BannerConfig) return false
        return referralTitle == other.referralTitle &&
            referralDescription == other.referralDescription &&
            referralCta == other.referralCta &&
            inappTitle == other.inappTitle &&
            inappDescription == other.inappDescription &&
            inappCta == other.inappCta &&
            imageUrl == other.imageUrl
    }

    override fun hashCode(): Int {
        var result = referralTitle?.hashCode() ?: 0
        result = 31 * result + (referralDescription?.hashCode() ?: 0)
        result = 31 * result + (referralCta?.hashCode() ?: 0)
        result = 31 * result + (inappTitle?.hashCode() ?: 0)
        result = 31 * result + (inappDescription?.hashCode() ?: 0)
        result = 31 * result + (inappCta?.hashCode() ?: 0)
        result = 31 * result + (imageUrl?.hashCode() ?: 0)
        return result
    }
}

/** Merged by the backend over anything the SDK supplies. */
public class AttributionDefaults(
    public val utmSource: String? = null,
    public val utmMedium: String? = null,
    public val utmCampaign: String? = null,
    public val utmTerm: String? = null,
    public val via: String? = null,
    public val ref: String? = null,
) {
    override fun toString(): String =
        "AttributionDefaults(utmSource=$utmSource, utmMedium=$utmMedium, utmCampaign=$utmCampaign, " +
            "utmTerm=$utmTerm, via=$via, ref=$ref)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is AttributionDefaults) return false
        return utmSource == other.utmSource &&
            utmMedium == other.utmMedium &&
            utmCampaign == other.utmCampaign &&
            utmTerm == other.utmTerm &&
            via == other.via &&
            ref == other.ref
    }

    override fun hashCode(): Int {
        var result = utmSource?.hashCode() ?: 0
        result = 31 * result + (utmMedium?.hashCode() ?: 0)
        result = 31 * result + (utmCampaign?.hashCode() ?: 0)
        result = 31 * result + (utmTerm?.hashCode() ?: 0)
        result = 31 * result + (via?.hashCode() ?: 0)
        result = 31 * result + (ref?.hashCode() ?: 0)
        return result
    }
}
