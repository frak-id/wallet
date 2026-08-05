package id.frak.sdk.config

import id.frak.sdk.core.FrakCurrency
import id.frak.sdk.core.FrakLanguage

/*
 * Hand-built resolved-config trees for the tests that need one.
 *
 * The tree's own constructors take no default arguments on purpose — a defaulted constructor emits
 * a `DefaultConstructorMarker` bridge that lands in the `.api` dump and freezes an arity, which is
 * finding A3. The defaults were only ever a convenience for callers, and the only production caller
 * (`ResolvedConfigDecoder`) passes every argument anyway. So they live here instead, where the
 * convenience costs nothing: a new field is a new parameter on one of these helpers, and every test
 * that does not care about it keeps compiling.
 *
 * `internal`, and reachable only because a same-module test source set has friend access to
 * `internal` — which is also exactly why `PublicSurfaceTest` can no longer claim to prove anything
 * about what a merchant can construct. See the note in that file.
 */

internal fun resolvedConfig(
    merchantId: String = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f",
    name: String = "Acme",
    domain: String = "acme.example",
    lang: FrakLanguage? = null,
    currency: FrakCurrency? = null,
    hidden: Boolean = false,
    sdkConfig: ResolvedSdkConfig? = null,
): FrakResolvedConfig = FrakResolvedConfig(merchantId, name, domain, lang, currency, hidden, sdkConfig)

internal fun resolvedSdkConfig(
    name: String? = null,
    logoUrl: String? = null,
    homepageLink: String? = null,
    currency: FrakCurrency? = null,
    lang: FrakLanguage? = null,
    hidden: Boolean = false,
    translations: Map<String, String> = emptyMap(),
    placements: Map<String, ResolvedPlacement> = emptyMap(),
    components: ResolvedComponents? = null,
    attribution: AttributionDefaults? = null,
): ResolvedSdkConfig =
    ResolvedSdkConfig(
        name,
        logoUrl,
        homepageLink,
        currency,
        lang,
        hidden,
        translations,
        placements,
        components,
        attribution,
    )

internal fun resolvedPlacement(
    components: ResolvedComponents? = null,
    targetInteraction: String? = null,
    translations: Map<String, String> = emptyMap(),
): ResolvedPlacement = ResolvedPlacement(components, targetInteraction, translations)

internal fun resolvedComponents(
    buttonShare: ButtonShareConfig? = null,
    buttonWallet: ButtonWalletConfig? = null,
    openInApp: OpenInAppConfig? = null,
    postPurchase: PostPurchaseConfig? = null,
    banner: BannerConfig? = null,
): ResolvedComponents = ResolvedComponents(buttonShare, buttonWallet, openInApp, postPurchase, banner)

internal fun buttonShareConfig(
    text: String? = null,
    noRewardText: String? = null,
    clickAction: String? = null,
): ButtonShareConfig = ButtonShareConfig(text, noRewardText, clickAction)

internal fun buttonWalletConfig(position: String? = null): ButtonWalletConfig = ButtonWalletConfig(position)

internal fun openInAppConfig(text: String? = null): OpenInAppConfig = OpenInAppConfig(text)

internal fun postPurchaseConfig(
    badgeText: String? = null,
    refereeText: String? = null,
    refereeNoRewardText: String? = null,
    referrerText: String? = null,
    referrerNoRewardText: String? = null,
    ctaText: String? = null,
    ctaNoRewardText: String? = null,
    imageUrl: String? = null,
): PostPurchaseConfig =
    PostPurchaseConfig(
        badgeText,
        refereeText,
        refereeNoRewardText,
        referrerText,
        referrerNoRewardText,
        ctaText,
        ctaNoRewardText,
        imageUrl,
    )

internal fun bannerConfig(
    referralTitle: String? = null,
    referralDescription: String? = null,
    referralCta: String? = null,
    inappTitle: String? = null,
    inappDescription: String? = null,
    inappCta: String? = null,
    imageUrl: String? = null,
): BannerConfig =
    BannerConfig(
        referralTitle,
        referralDescription,
        referralCta,
        inappTitle,
        inappDescription,
        inappCta,
        imageUrl,
    )

internal fun attributionDefaults(
    utmSource: String? = null,
    utmMedium: String? = null,
    utmCampaign: String? = null,
    utmTerm: String? = null,
    via: String? = null,
    ref: String? = null,
): AttributionDefaults = AttributionDefaults(utmSource, utmMedium, utmCampaign, utmTerm, via, ref)
