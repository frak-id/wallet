import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { toLocalizedText } from "../localizable";
import type { BannerFormValues, PostPurchaseFormValues } from "../types";

type PlacementComponents = NonNullable<
    NonNullable<SdkConfig["placements"]>[string]
>["components"];

export function getBannerDefaults(
    components: PlacementComponents
): BannerFormValues {
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

export function getPostPurchaseDefaults(
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
