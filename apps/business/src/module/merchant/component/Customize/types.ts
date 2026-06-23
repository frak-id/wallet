import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";

export type SdkIdentityFormValues = {
    name: string;
    logoUrl: string;
    homepageLink: string;
    currency: "" | "eur" | "usd" | "gbp";
    lang: "" | "en" | "fr";
    hidden: boolean;
};

export type CssFormValues = {
    css: string;
};

export type ComponentType = "buttonShare" | "postPurchase" | "banner";

export const COMPONENT_TYPES: ComponentType[] = [
    "buttonShare",
    "postPurchase",
    "banner",
];

// Editable tabs, mirroring the backend `LocalizableString` ({ default, en, fr }).
// `default` is the language-agnostic fallback (a bare string); `en`/`fr` override it.
export const SUPPORTED_WORDING_LANGS = ["default", "en", "fr"] as const;
export type WordingLang = (typeof SUPPORTED_WORDING_LANGS)[number];

// Languages a preset ships copy for (the `default` tier is never preset-authored).
export const PRESET_LANGS = ["en", "fr"] as const;
export type PresetLang = (typeof PRESET_LANGS)[number];

// Empty string means "not set" for that tier; empties are dropped at save.
export type LocalizedText = Record<WordingLang, string>;

type Components = NonNullable<SdkConfig["components"]>;
type ComponentOf<K extends keyof Components> = NonNullable<Components[K]>;

type ButtonShareFormValues = {
    text: LocalizedText;
    noRewardText: LocalizedText;
    clickAction: NonNullable<ComponentOf<"buttonShare">["clickAction"]>;
    css: string;
};

export type PostPurchaseFormValues = {
    badgeText: LocalizedText;
    refereeText: LocalizedText;
    refereeNoRewardText: LocalizedText;
    referrerText: LocalizedText;
    referrerNoRewardText: LocalizedText;
    ctaText: LocalizedText;
    ctaNoRewardText: LocalizedText;
    css: string;
};

export type BannerFormValues = {
    referralTitle: LocalizedText;
    referralDescription: LocalizedText;
    referralCta: LocalizedText;
    inappTitle: LocalizedText;
    inappDescription: LocalizedText;
    inappCta: LocalizedText;
    css: string;
};

export type ComponentSettingsFormValues = {
    targetInteraction: string;
    buttonShare: ButtonShareFormValues;
    postPurchase: PostPurchaseFormValues;
    banner: BannerFormValues;
};
