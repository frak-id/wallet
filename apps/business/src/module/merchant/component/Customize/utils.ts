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
};

export type CssFormValues = {
    css: string;
};

export type PlacementSettingsFormValues = {
    triggerText: string;
    triggerNoRewardText: string;
    triggerPosition: "bottom-right" | "bottom-left";
    triggerShowWallet: boolean;
    targetInteraction: string;
};

export const TRANSLATION_GROUPS = {
    "modal.dismiss": [
        "sdk.modal.dismiss.primaryAction",
        "sdk.modal.dismiss.primaryAction_sharing",
    ],
    "modal.final": [
        "sdk.modal.final.title",
        "sdk.modal.final.title_reward",
        "sdk.modal.final.title_sharing",
        "sdk.modal.final.description",
        "sdk.modal.final.description_sharing",
        "sdk.modal.final.description_reward",
        "sdk.modal.final.dismissed.description",
        "sdk.modal.final.dismissed.description_sharing",
    ],
    "modal.login": [
        "sdk.modal.login.description",
        "sdk.modal.login.description_sharing",
        "sdk.modal.login.description_reward",
        "sdk.modal.login.primaryAction",
        "sdk.modal.login.secondaryAction",
        "sdk.modal.login.title",
        "sdk.modal.login.success",
    ],
    "modal.sendTransaction": [
        "sdk.modal.sendTransaction.description",
        "sdk.modal.sendTransaction.primaryAction_one",
        "sdk.modal.sendTransaction.primaryAction_other",
        "sdk.modal.sendTransaction.title",
    ],
    "modal.siweAuthenticate": [
        "sdk.modal.siweAuthenticate.description",
        "sdk.modal.siweAuthenticate.primaryAction",
        "sdk.modal.siweAuthenticate.title",
    ],
    "wallet.login": [
        "sdk.wallet.login.text",
        "sdk.wallet.login.text_referred",
        "sdk.wallet.login.primaryAction",
    ],
    "wallet.loggedIn": [
        "sdk.wallet.loggedIn.onboarding.welcome",
        "sdk.wallet.loggedIn.onboarding.share",
        "sdk.wallet.loggedIn.onboarding.share_referred",
    ],
} as const;

export const TRANSLATION_LANG_FIELDS = {
    default: "translationsDefault",
    en: "translationsEn",
    fr: "translationsFr",
} as const;

export function valueOrNull(value: string): string | null {
    return value.trim() === "" ? null : value;
}

export function valueOrUndefined(value: string): string | undefined {
    return value.trim() === "" ? undefined : value;
}

/**
 * react-hook-form uses dot-notation as nesting separators. A field registered
 * as `translationsDefault.sdk.modal.title` expects the form value at the
 * nested path `{ sdk: { modal: { title: "v" } } }`.
 *
 * The backend stores flat keys: `{ "sdk.modal.title": "v" }`.
 *
 * unflattenRecord converts flat → nested (backend → form input).
 * flattenRecord converts nested → flat (form output → backend).
 */
function unflattenRecord(
    flat: Record<string, string>
): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(flat)) {
        const parts = key.split(".");
        let current: Record<string, unknown> = result;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!(part in current) || typeof current[part] !== "object") {
                current[part] = {};
            }
            current = current[part] as Record<string, unknown>;
        }
        current[parts[parts.length - 1]] = value;
    }
    return result;
}

function flattenRecord(
    obj: Record<string, unknown>,
    prefix = ""
): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "string") {
            result[fullKey] = value;
        } else if (typeof value === "object" && value !== null) {
            Object.assign(
                result,
                flattenRecord(value as Record<string, unknown>, fullKey)
            );
        }
    }
    return result;
}

function normalizeTranslationsRecord(
    values: Record<string, unknown>
): Record<string, string> {
    const flat = flattenRecord(values as Record<string, unknown>);
    return Object.fromEntries(
        Object.entries(flat).filter(([, v]) => v.trim() !== "")
    );
}

/**
 * Walk a nested error object along a dot-path and return the message.
 *
 * react-hook-form stores errors at the nested path, e.g.
 * `errors.translationsDefault.sdk.modal.title.message` — but the
 * translation key is a single string like `"sdk.modal.title"`.
 */
export function getNestedFieldError(
    errors: Record<string, unknown> | undefined,
    dotPath: string
): string | undefined {
    if (!errors) return undefined;
    const parts = dotPath.split(".");
    let current: unknown = errors;
    for (const part of parts) {
        if (!current || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    if (current && typeof current === "object" && "message" in current) {
        return (current as { message?: string }).message;
    }
    return undefined;
}

export function getSdkConfig(
    sdkConfig: SdkConfig | null | undefined
): SdkConfig {
    return sdkConfig ?? {};
}

export function getTranslationsFormValues(
    translations: SdkConfig["translations"] | undefined | null
): TranslationFormValues {
    return {
        translationsDefault: unflattenRecord(
            translations?.default ?? {}
        ) as TranslationFormValues["translationsDefault"],
        translationsEn: unflattenRecord(
            translations?.en ?? {}
        ) as TranslationFormValues["translationsEn"],
        translationsFr: unflattenRecord(
            translations?.fr ?? {}
        ) as TranslationFormValues["translationsFr"],
    };
}

export function getPlacementTranslationsFormValues(
    sdkConfig: SdkConfig,
    placementId: string
): TranslationFormValues {
    const placement = sdkConfig.placements?.[placementId];
    return {
        translationsDefault: unflattenRecord(
            placement?.translations?.default ?? {}
        ) as TranslationFormValues["translationsDefault"],
        translationsEn: unflattenRecord(
            placement?.translations?.en ?? {}
        ) as TranslationFormValues["translationsEn"],
        translationsFr: unflattenRecord(
            placement?.translations?.fr ?? {}
        ) as TranslationFormValues["translationsFr"],
    };
}

export function buildTranslationsPayload(values: TranslationFormValues) {
    const defaultValues = normalizeTranslationsRecord(
        values.translationsDefault
    );
    const enValues = normalizeTranslationsRecord(values.translationsEn);
    const frValues = normalizeTranslationsRecord(values.translationsFr);

    const hasAnyValues =
        Object.keys(defaultValues).length > 0 ||
        Object.keys(enValues).length > 0 ||
        Object.keys(frValues).length > 0;

    return {
        translations: {
            default: defaultValues,
            en: enValues,
            fr: frValues,
        },
        hasAnyValues,
    };
}

export function updatePlacement(
    sdkConfig: SdkConfig,
    placementId: string,
    update: (
        placement: NonNullable<NonNullable<SdkConfig["placements"]>[string]>
    ) => NonNullable<NonNullable<SdkConfig["placements"]>[string]>
) {
    const currentPlacements = sdkConfig.placements ?? {};
    const currentPlacement = currentPlacements[placementId] ?? {};

    return {
        ...currentPlacements,
        [placementId]: update(currentPlacement),
    };
}
