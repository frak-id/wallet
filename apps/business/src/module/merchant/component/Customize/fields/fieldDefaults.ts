import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import type { BannerFormValues, PostPurchaseFormValues } from "../types";

type PlacementComponents = NonNullable<
    NonNullable<SdkConfig["placements"]>[string]
>["components"];

export function getBannerDefaults(
    components: PlacementComponents
): BannerFormValues {
    const b = components?.banner;
    return {
        referralTitle: b?.referralTitle ?? "",
        referralDescription: b?.referralDescription ?? "",
        referralCta: b?.referralCta ?? "",
        inappTitle: b?.inappTitle ?? "",
        inappDescription: b?.inappDescription ?? "",
        inappCta: b?.inappCta ?? "",
        css: b?.rawCss ?? "",
    };
}

export function getPostPurchaseDefaults(
    components: PlacementComponents
): PostPurchaseFormValues {
    const pp = components?.postPurchase;
    return {
        refereeText: pp?.refereeText ?? "",
        refereeNoRewardText: pp?.refereeNoRewardText ?? "",
        referrerText: pp?.referrerText ?? "",
        referrerNoRewardText: pp?.referrerNoRewardText ?? "",
        ctaText: pp?.ctaText ?? "",
        ctaNoRewardText: pp?.ctaNoRewardText ?? "",
        css: pp?.rawCss ?? "",
    };
}
