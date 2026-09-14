import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { fromLocalizedText, toLocalizedText } from "../localizable";
import { parseStyleCss, serializeStyleCss } from "../style/styleCodec";
import type {
    BannerFormValues,
    ButtonShareFormValues,
    ComponentSettingsFormValues,
    PostPurchaseFormValues,
    StyleTier,
} from "../types";
import { valueOrUndefined } from "../utils";

type PlacementComponents =
    | NonNullable<NonNullable<SdkConfig["placements"]>[string]>["components"]
    | SdkConfig["components"];

function getButtonShareDefaults(
    components: PlacementComponents
): ButtonShareFormValues {
    const bs = components?.buttonShare;
    const { values, foreignCss } = parseStyleCss(bs?.rawCss);
    return {
        text: toLocalizedText(bs?.text),
        noRewardText: toLocalizedText(bs?.noRewardText),
        css: bs?.rawCss ?? "",
        style: values,
        foreignCss,
    };
}

function getBannerDefaults(components: PlacementComponents): BannerFormValues {
    const b = components?.banner;
    return {
        referralTitle: toLocalizedText(b?.referralTitle),
        referralDescription: toLocalizedText(b?.referralDescription),
        referralCta: toLocalizedText(b?.referralCta),
        inappTitle: toLocalizedText(b?.inappTitle),
        inappDescription: toLocalizedText(b?.inappDescription),
        inappCta: toLocalizedText(b?.inappCta),
        imageUrl: b?.imageUrl ?? "",
        css: b?.rawCss ?? "",
    };
}

function getPostPurchaseDefaults(
    components: PlacementComponents
): PostPurchaseFormValues {
    const pp = components?.postPurchase;
    return {
        badgeText: toLocalizedText(pp?.badgeText),
        refereeText: toLocalizedText(pp?.refereeText),
        refereeNoRewardText: toLocalizedText(pp?.refereeNoRewardText),
        referrerText: toLocalizedText(pp?.referrerText),
        referrerNoRewardText: toLocalizedText(pp?.referrerNoRewardText),
        ctaText: toLocalizedText(pp?.ctaText),
        ctaNoRewardText: toLocalizedText(pp?.ctaNoRewardText),
        imageUrl: pp?.imageUrl ?? "",
        css: pp?.rawCss ?? "",
    };
}

/** Stored components -> editable form values (shared by default + placement). */
export function componentsToFormValues(components: PlacementComponents) {
    return {
        buttonShare: getButtonShareDefaults(components),
        postPurchase: getPostPurchaseDefaults(components),
        banner: getBannerDefaults(components),
    };
}

/**
 * Editable form values -> stored components (shared by default + placement).
 * The share button's `rawCss` is recomposed from the style controls and the
 * CSS the codec did not author, so the tier decides the emitted selector.
 */
export function formValuesToComponents(
    v: ComponentSettingsFormValues,
    tier: StyleTier
) {
    return {
        buttonShare: {
            text: fromLocalizedText(v.buttonShare.text),
            noRewardText: fromLocalizedText(v.buttonShare.noRewardText),
            clickAction: "sharing-page" as const,
            rawCss: serializeStyleCss(
                v.buttonShare.style,
                v.buttonShare.foreignCss,
                tier
            ),
        },
        postPurchase: {
            badgeText: fromLocalizedText(v.postPurchase.badgeText),
            refereeText: fromLocalizedText(v.postPurchase.refereeText),
            refereeNoRewardText: fromLocalizedText(
                v.postPurchase.refereeNoRewardText
            ),
            referrerText: fromLocalizedText(v.postPurchase.referrerText),
            referrerNoRewardText: fromLocalizedText(
                v.postPurchase.referrerNoRewardText
            ),
            ctaText: fromLocalizedText(v.postPurchase.ctaText),
            ctaNoRewardText: fromLocalizedText(v.postPurchase.ctaNoRewardText),
            imageUrl: valueOrUndefined(v.postPurchase.imageUrl),
            rawCss: valueOrUndefined(v.postPurchase.css),
        },
        banner: {
            referralTitle: fromLocalizedText(v.banner.referralTitle),
            referralDescription: fromLocalizedText(
                v.banner.referralDescription
            ),
            referralCta: fromLocalizedText(v.banner.referralCta),
            inappTitle: fromLocalizedText(v.banner.inappTitle),
            inappDescription: fromLocalizedText(v.banner.inappDescription),
            inappCta: fromLocalizedText(v.banner.inappCta),
            imageUrl: valueOrUndefined(v.banner.imageUrl),
            rawCss: valueOrUndefined(v.banner.css),
        },
    };
}
