export type TranslationLang = "default" | "en" | "fr";

export type TranslationFormValues = {
    translationsDefault: Record<string, string>;
    translationsEn: Record<string, string>;
    translationsFr: Record<string, string>;
};

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

export type ButtonShareFormValues = {
    text: string;
    noRewardText: string;
    clickAction: "embedded-wallet" | "share-modal" | "sharing-page";
    useReward: boolean;
    css: string;
};

export type PostPurchaseFormValues = {
    refereeText: string;
    refereeNoRewardText: string;
    referrerText: string;
    referrerNoRewardText: string;
    ctaText: string;
    ctaNoRewardText: string;
    css: string;
};

export type BannerFormValues = {
    referralTitle: string;
    referralDescription: string;
    referralCta: string;
    inappTitle: string;
    inappDescription: string;
    inappCta: string;
    css: string;
};

export type PlacementSettingsFormValues = {
    targetInteraction: string;
    buttonShare: ButtonShareFormValues;
    postPurchase: PostPurchaseFormValues;
    banner: BannerFormValues;
};
