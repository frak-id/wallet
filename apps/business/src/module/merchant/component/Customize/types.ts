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
const PRESET_LANGS = ["en", "fr"] as const;
export type PresetLang = (typeof PRESET_LANGS)[number];

// Empty string means "not set" for that tier; empties are dropped at save.
export type LocalizedText = Record<WordingLang, string>;

// Tier the style block writes for: the `default` literal, or a placement id.
// Only the default tier self-scopes; the backend wraps every other tier.
export type StyleTier = string;

// One optional entry per style control; absent means the control is unset and
// emits nothing. Colours are hex, except `bg` which also takes `transparent`.
export type ButtonShareStyleValues = {
    bg?: string;
    fg?: string;
    bw?: number;
    bc?: string;
    fs?: number;
    py?: number;
    px?: number;
    mt?: number;
    mb?: number;
};

export type ButtonShareFormValues = {
    text: LocalizedText;
    noRewardText: LocalizedText;
    css: string;
    style: ButtonShareStyleValues;
    foreignCss: string;
};

export type PostPurchaseFormValues = {
    badgeText: LocalizedText;
    refereeText: LocalizedText;
    refereeNoRewardText: LocalizedText;
    referrerText: LocalizedText;
    referrerNoRewardText: LocalizedText;
    ctaText: LocalizedText;
    ctaNoRewardText: LocalizedText;
    imageUrl: string;
    css: string;
};

export type BannerFormValues = {
    referralTitle: LocalizedText;
    referralDescription: LocalizedText;
    referralCta: LocalizedText;
    inappTitle: LocalizedText;
    inappDescription: LocalizedText;
    inappCta: LocalizedText;
    imageUrl: string;
    css: string;
};

// The two OS-share-sheet keys. Stored in `sdkConfig.translations` (a tiered
// key -> string dictionary), not in `components`, so this is its own form
// rather than a fourth `ComponentType`.
export const SHARING_TRANSLATION_KEYS = {
    title: "sharing.title",
    text: "sharing.text",
} as const;

export type SharingWordingFormValues = {
    title: LocalizedText;
    text: LocalizedText;
};

export type ComponentSettingsFormValues = {
    targetInteraction: string;
    buttonShare: ButtonShareFormValues;
    postPurchase: PostPurchaseFormValues;
    banner: BannerFormValues;
};
