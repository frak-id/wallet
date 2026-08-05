package id.frak.sdk.config

import id.frak.sdk.core.FrakCurrency
import id.frak.sdk.core.FrakLanguage

/*
 * The resolved-config tree: ten classes, fifty-one properties, one `GET /user/merchant/resolve`
 * response.
 *
 * Every constructor in this file is `internal`, and none takes a default argument. Both halves
 * matter, and they are the whole reason this tree needs no Builder:
 *
 *  - A **public** constructor freezes an arity. A defaulted one freezes two — the full-arity
 *    `<init>` plus a synthetic `<init>(…, int mask, DefaultConstructorMarker)` — and adding a
 *    field changes both descriptors, so an already-compiled merchant binary gets
 *    `NoSuchMethodError`. That is finding A3, and it has already fired once on `FrakConfig`.
 *  - An **internal** constructor is not a promise. A Kotlin merchant cannot see it, and
 *    binary-compatibility-validator leaves it out of the `.api` dump — which is what the
 *    compatibility contract is. So a new backend field is a new getter and nothing else: additive
 *    forever, with no Builder to write and no wire-shaped defaults to restate. (It is not a *hard*
 *    block: Kotlin mangles `internal` functions but cannot mangle a constructor, so it is emitted
 *    `public` and a Java caller could still reach it. Doing so puts them outside the contract, which
 *    is the same deal `@InternalFrakApi` offers.)
 *  - **No defaults even so**, because a defaulted internal constructor still emits the
 *    `DefaultConstructorMarker` bridge as `public synthetic`, and that bridge *does* land in the
 *    dump. `ResolvedConfigDecoder` — the only production caller — already passes every argument,
 *    so the defaults were never load-bearing.
 *
 * These are deliberately not `data class`es: a published `copy()`/`componentN()` would enter the
 * ABI and could never be removed. Hence hand-written `equals`/`hashCode`/`toString`.
 *
 * The tree is `public` rather than `internal` because its reader, the sharing sheet, lives in the
 * separate `:frak-sdk-ui` artifact and only sees `public` API — the same reason iOS gives. It is
 * also genuinely merchant-facing: [ConfigApi.resolve][id.frak.sdk.ConfigApi.resolve] hands one
 * back, and the copy-precedence tiers below are what a merchant reads to render their own share
 * affordance with backend-configured copy. That is why it carries no `@InternalFrakApi` marker:
 * marking it would propagate to `resolve()` itself and take the one API path ever exercised on a
 * device out of both the dump and every merchant's reach.
 */

/** What the backend knows about this merchant, as resolved by `GET /user/merchant/resolve`. */
public class FrakResolvedConfig internal constructor(
    public val merchantId: String,
    public val name: String,
    /** Merchant's canonical domain, not whatever domain was queried. */
    public val domain: String,
    /** Null when the backend sends a value this SDK's build does not recognise. */
    public val lang: FrakLanguage?,
    /** May differ from [id.frak.sdk.core.FrakMetadata.currency]; informational only, never used for formatting. */
    public val currency: FrakCurrency?,
    public val hidden: Boolean,
    public val sdkConfig: ResolvedSdkConfig?,
) {
    /**
     * Name to show a user: the `sdkConfig` override when the backend sent one, else [name].
     *
     * A derived property rather than a fold each reader writes for itself — the sharing sheet needs
     * exactly this, a merchant rendering their own share affordance needs exactly this, and the
     * precedence is a rule, not an implementation detail. Resolving it here keeps `:frak-sdk-ui` off
     * the deep tree and puts the rule somewhere `FrakResolvedConfigTest` can pin it against a real
     * decoded response.
     *
     * Non-null: [name] comes from a `required` wire field that the decoder rejects when absent or
     * empty, and `sdkConfig?.name` is normalised to absent when empty, so the elvis always has a
     * value to fall back to.
     *
     * `display`-prefixed on purpose. It is derived, not a wire field, and the top level of the
     * resolve response is free to grow a real `name`-adjacent field later without this name already
     * being taken — repointing a getter is a behaviour change with an unchanged JVM descriptor,
     * which no `.api` dump could catch.
     */
    public val displayName: String get() = sdkConfig?.name ?: name

    /**
     * Logo to show alongside [displayName], from the resolved `sdkConfig`, or null when the backend
     * has none on file.
     *
     * `displayLogoUrl`, not `logoUrl`, for the reason given on [displayName]: `logoUrl` is exactly
     * what a future top-level wire field would be called, and a derived property must not squat on
     * that name.
     */
    public val displayLogoUrl: String? get() = sdkConfig?.logoUrl

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

/** The `sdkConfig` block of the resolve response. Wire-shaped: every field may be absent. */
public class ResolvedSdkConfig internal constructor(
    public val name: String?,
    public val logoUrl: String?,
    public val homepageLink: String?,
    public val currency: FrakCurrency?,
    public val lang: FrakLanguage?,
    public val hidden: Boolean,
    public val translations: Map<String, String>,
    /** Tier 1 of the copy precedence. */
    public val placements: Map<String, ResolvedPlacement>,
    /** Tier 2 of the copy precedence. */
    public val components: ResolvedComponents?,
    public val attribution: AttributionDefaults?,
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
public class ResolvedPlacement internal constructor(
    public val components: ResolvedComponents?,
    public val targetInteraction: String?,
    public val translations: Map<String, String>,
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
public class ResolvedComponents internal constructor(
    public val buttonShare: ButtonShareConfig?,
    public val buttonWallet: ButtonWalletConfig?,
    public val openInApp: OpenInAppConfig?,
    public val postPurchase: PostPurchaseConfig?,
    public val banner: BannerConfig?,
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

public class ButtonShareConfig internal constructor(
    public val text: String?,
    /** Copy for when there is no concrete reward to advertise (e.g. a percentage-only campaign). */
    public val noRewardText: String?,
    public val clickAction: String?,
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

public class ButtonWalletConfig internal constructor(
    public val position: String?,
) {
    override fun toString(): String = "ButtonWalletConfig(position=$position)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is ButtonWalletConfig) return false
        return position == other.position
    }

    override fun hashCode(): Int = position?.hashCode() ?: 0
}

public class OpenInAppConfig internal constructor(
    public val text: String?,
) {
    override fun toString(): String = "OpenInAppConfig(text=$text)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is OpenInAppConfig) return false
        return text == other.text
    }

    override fun hashCode(): Int = text?.hashCode() ?: 0
}

public class PostPurchaseConfig internal constructor(
    public val badgeText: String?,
    public val refereeText: String?,
    public val refereeNoRewardText: String?,
    public val referrerText: String?,
    public val referrerNoRewardText: String?,
    public val ctaText: String?,
    public val ctaNoRewardText: String?,
    public val imageUrl: String?,
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

public class BannerConfig internal constructor(
    public val referralTitle: String?,
    public val referralDescription: String?,
    public val referralCta: String?,
    public val inappTitle: String?,
    public val inappDescription: String?,
    public val inappCta: String?,
    public val imageUrl: String?,
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
public class AttributionDefaults internal constructor(
    public val utmSource: String?,
    public val utmMedium: String?,
    public val utmCampaign: String?,
    public val utmTerm: String?,
    public val via: String?,
    public val ref: String?,
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
