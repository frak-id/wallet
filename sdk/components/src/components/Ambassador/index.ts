import { registerWebComponent } from "@/webcomponent/registerWebComponent";
import { Ambassador } from "./Ambassador";
import type { AmbassadorProps } from "./types";

export { Ambassador };

/**
 * Custom element interface for `<frak-ambassador>`.
 * Combines standard {@link HTMLElement} with {@link AmbassadorProps}.
 */
export interface AmbassadorElement extends HTMLElement, AmbassadorProps {}

declare global {
    interface HTMLElementTagNameMap {
        "frak-ambassador": AmbassadorElement;
    }
}

const observedAttributes = [
    "merchantId",
    "classname",
    "heroTitle",
    "heroEyebrow",
    "heroLede",
    "heroCtaLabel",
    "heroFacesCaption",
    "heroImageUrl",
    "heroImageAlt",
    "heroRewardCaption",
    "heroRewardRefereePill",
    "rewardEyebrow",
    "rewardHeading",
    "rewardEstimateCaption",
    "rewardLede",
    "rewardCtaLabel",
    "rewardFooterCaption",
    "rewardNoBankDetails",
    "rewardFallbackLabel",
    "explainerTitle",
    "explainerLede",
    "step1Title",
    "step1Description",
    "step1ImageUrl",
    "step1ImageAlt",
    "step2Title",
    "step2Description",
    "step2ImageUrl",
    "step2ImageAlt",
    "step3Title",
    "step3Description",
    "step3ImageUrl",
    "step3ImageAlt",
    "winWinHeading",
    "winWinLede",
    "winWinCard1Title",
    "winWinCard1Description",
    "winWinCard2Title",
    "winWinCard2Description",
    "referralHeading",
    "referralLede",
    "referralCtaLabel",
    "storeHeading",
    "storeLede",
    "storeAppBadgeAriaLabel",
    "storePlayBadgeAriaLabel",
    "storeQrLabel",
    "storeQrCaption",
    "faqHeading",
    "faq1Question",
    "faq1Answer",
    "faq2Question",
    "faq2Answer",
    "faq3Question",
    "faq3Answer",
    "faq4Question",
    "faq4Answer",
    "faq5Question",
    "faq5AnswerBeforeLink",
    "faq5AnswerLinkText",
    "faq5AnswerAfterLink",
    "attributionBeforeLink",
    "attributionLinkText",
] as const satisfies readonly (keyof AmbassadorProps)[];

// Fails typecheck, naming the prop, when a prop is missing from the list above.
({}) satisfies Record<
    Exclude<keyof AmbassadorProps, (typeof observedAttributes)[number]>,
    never
>;

registerWebComponent(Ambassador, "frak-ambassador", [...observedAttributes], {
    shadow: false,
});
