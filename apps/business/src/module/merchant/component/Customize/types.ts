import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";

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

export const COMPONENT_TYPES: ComponentType[] = [
    "buttonShare",
    "postPurchase",
    "banner",
];

// Derive form types from backend schema
// Required<> because controlled inputs need concrete values ("" not undefined)
// rawCss → css rename, processed css excluded
type Components = NonNullable<SdkConfig["components"]>;
type ComponentOf<K extends keyof Components> = NonNullable<Components[K]>;
type ComponentFormFields<T> = Required<Omit<T, "css" | "rawCss">> & {
    css: string;
};

export type ButtonShareFormValues = ComponentFormFields<
    ComponentOf<"buttonShare">
>;
export type PostPurchaseFormValues = ComponentFormFields<
    ComponentOf<"postPurchase">
>;
export type BannerFormValues = ComponentFormFields<ComponentOf<"banner">>;

export type ComponentSettingsFormValues = {
    targetInteraction: string;
    buttonShare: ButtonShareFormValues;
    postPurchase: PostPurchaseFormValues;
    banner: BannerFormValues;
};
