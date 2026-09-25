import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { fromLocalizedText, toLocalizedText } from "./localizable";
import type { LocalizedText } from "./types";

export type StoredAmbassador = NonNullable<
    NonNullable<SdkConfig["components"]>["ambassador"]
>;

export const AMBASSADOR_FIELD_GROUPS = {
    hero: ["heroTitle", "heroLede", "heroRewardCaption"],
    reward: ["rewardHeading", "rewardLede"],
    buttons: ["heroCtaLabel", "rewardCtaLabel", "referralCtaLabel"],
    faq: [
        "faq1Question",
        "faq1Answer",
        "faq2Question",
        "faq2Answer",
        "faq3Question",
        "faq3Answer",
        "faq4Question",
        "faq4Answer",
        "faq5Question",
        "faq5Answer",
    ],
} as const;

export type AmbassadorTextField =
    (typeof AMBASSADOR_FIELD_GROUPS)[keyof typeof AMBASSADOR_FIELD_GROUPS][number];

const TEXT_FIELDS = Object.values(
    AMBASSADOR_FIELD_GROUPS
).flat() as AmbassadorTextField[];

export type AmbassadorPhotoMode = "default" | "custom" | "none";

export type AmbassadorFormValues = {
    photo: AmbassadorPhotoMode;
    heroImageUrl: string;
    texts: Record<AmbassadorTextField, LocalizedText>;
};

export function ambassadorToFormValues(
    stored: StoredAmbassador | undefined
): AmbassadorFormValues {
    const image = stored?.heroImageUrl;
    return {
        photo: image === "none" ? "none" : image ? "custom" : "default",
        heroImageUrl: image && image !== "none" ? image : "",
        texts: Object.fromEntries(
            TEXT_FIELDS.map((field) => [
                field,
                toLocalizedText(stored?.[field]),
            ])
        ) as AmbassadorFormValues["texts"],
    };
}

/** `undefined` when nothing is set, so saving clears the stored entry. */
export function formValuesToAmbassador(
    values: AmbassadorFormValues
): StoredAmbassador | undefined {
    const stored: StoredAmbassador = {};
    for (const field of TEXT_FIELDS) {
        const text = fromLocalizedText(values.texts[field]);
        if (text !== undefined) stored[field] = text;
    }
    const url = values.heroImageUrl.trim();
    if (values.photo === "none") stored.heroImageUrl = "none";
    if (values.photo === "custom" && url) stored.heroImageUrl = url;
    return Object.keys(stored).length > 0 ? stored : undefined;
}
