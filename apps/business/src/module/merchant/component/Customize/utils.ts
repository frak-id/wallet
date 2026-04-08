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

export type ComponentType =
    | "buttonShare"
    | "buttonWallet"
    | "openInApp"
    | "postPurchase";

export const COMPONENT_LABELS: Record<ComponentType, string> = {
    buttonShare: "Share Button",
    buttonWallet: "Wallet Button",
    openInApp: "Open in App",
    postPurchase: "Post Purchase",
};

export type ButtonShareFormValues = {
    text: string;
    noRewardText: string;
    clickAction: "embedded-wallet" | "share-modal" | "sharing-page";
    useReward: boolean;
    css: string;
};

export type ButtonWalletFormValues = {
    position: "bottom-right" | "bottom-left";
    css: string;
};

export type OpenInAppFormValues = {
    text: string;
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

export type PlacementSettingsFormValues = {
    targetInteraction: string;
    buttonShare: ButtonShareFormValues;
    buttonWallet: ButtonWalletFormValues;
    openInApp: OpenInAppFormValues;
    postPurchase: PostPurchaseFormValues;
};

/**
 * Translation groups for the embedded wallet flow (primary — always visible).
 */
export const EMBEDDED_TRANSLATION_GROUPS = {
    "Login Screen": [
        "sdk.wallet.login.text",
        "sdk.wallet.login.text_referred",
        "sdk.wallet.login.primaryAction",
    ],
    Onboarding: [
        "sdk.wallet.loggedIn.onboarding.welcome",
        "sdk.wallet.loggedIn.onboarding.share",
        "sdk.wallet.loggedIn.onboarding.share_referred",
    ],
} as const;

/**
 * Translation groups for the sharing page flow (primary — always visible).
 */
export const SHARING_PAGE_TRANSLATION_GROUPS = {
    "Sharing Page": [
        "sdk.sharingPage.dismiss",
        "sdk.sharingPage.reward.title",
        "sdk.sharingPage.reward.tagline",
    ],
    "Sharing Steps": [
        "sdk.sharingPage.steps.title",
        "sdk.sharingPage.steps.1",
        "sdk.sharingPage.steps.2",
        "sdk.sharingPage.steps.3",
    ],
    "Sharing FAQ": [
        "sdk.sharingPage.faq.title",
        "sdk.sharingPage.faq.q1",
        "sdk.sharingPage.faq.a1",
        "sdk.sharingPage.faq.q2",
        "sdk.sharingPage.faq.a2",
        "sdk.sharingPage.faq.q3",
        "sdk.sharingPage.faq.a3",
        "sdk.sharingPage.faq.q4",
        "sdk.sharingPage.faq.a4",
        "sdk.sharingPage.faq.q5",
        "sdk.sharingPage.faq.a5",
    ],
    "Post-Share Confirmation": [
        "sdk.sharingPage.confirmation.title",
        "sdk.sharingPage.confirmation.subtitle",
        "sdk.sharingPage.confirmation.benefits.wallet.title",
        "sdk.sharingPage.confirmation.benefits.wallet.description",
        "sdk.sharingPage.confirmation.benefits.notify.title",
        "sdk.sharingPage.confirmation.benefits.notify.description",
        "sdk.sharingPage.confirmation.benefits.cashout.title",
        "sdk.sharingPage.confirmation.benefits.cashout.description",
        "sdk.sharingPage.confirmation.cta",
    ],
} as const;

/**
 * Translation groups for the modal flow (advanced — collapsed by default).
 */
export const MODAL_TRANSLATION_GROUPS = {
    "Dismiss Step": [
        "sdk.modal.dismiss.primaryAction",
        "sdk.modal.dismiss.primaryAction_sharing",
    ],
    "Final Step": [
        "sdk.modal.final.title",
        "sdk.modal.final.title_reward",
        "sdk.modal.final.title_sharing",
        "sdk.modal.final.description",
        "sdk.modal.final.description_sharing",
        "sdk.modal.final.description_reward",
        "sdk.modal.final.dismissed.description",
        "sdk.modal.final.dismissed.description_sharing",
    ],
    "Login Step": [
        "sdk.modal.login.description",
        "sdk.modal.login.description_sharing",
        "sdk.modal.login.description_reward",
        "sdk.modal.login.primaryAction",
        "sdk.modal.login.secondaryAction",
        "sdk.modal.login.title",
        "sdk.modal.login.success",
    ],
    "Send Transaction Step": [
        "sdk.modal.sendTransaction.description",
        "sdk.modal.sendTransaction.primaryAction_one",
        "sdk.modal.sendTransaction.primaryAction_other",
        "sdk.modal.sendTransaction.title",
    ],
    "SIWE Authentication Step": [
        "sdk.modal.siweAuthenticate.description",
        "sdk.modal.siweAuthenticate.primaryAction",
        "sdk.modal.siweAuthenticate.title",
    ],
} as const;

/**
 * Combined groups for validation and payload building.
 */
export const ALL_TRANSLATION_GROUPS = {
    ...EMBEDDED_TRANSLATION_GROUPS,
    ...SHARING_PAGE_TRANSLATION_GROUPS,
    ...MODAL_TRANSLATION_GROUPS,
} as const;

export const TRANSLATION_KEY_META: Record<
    string,
    { label: string; description: string }
> = {
    "sdk.wallet.login.text": {
        label: "Login prompt",
        description:
            "Message shown to visitors who haven't connected their wallet yet",
    },
    "sdk.wallet.login.text_referred": {
        label: "Login prompt (referred visitor)",
        description:
            "Message shown to visitors who arrived via a referral link",
    },
    "sdk.wallet.login.primaryAction": {
        label: "Login button",
        description: "Text on the main login / connect button",
    },
    "sdk.wallet.loggedIn.onboarding.welcome": {
        label: "Welcome message",
        description: "Greeting shown after a user first connects their wallet",
    },
    "sdk.wallet.loggedIn.onboarding.share": {
        label: "Share prompt",
        description: "Message encouraging the user to share with friends",
    },
    "sdk.wallet.loggedIn.onboarding.share_referred": {
        label: "Share prompt (referred visitor)",
        description: "Share message for users who arrived via a referral link",
    },
    "sdk.modal.dismiss.primaryAction": {
        label: "Dismiss button",
        description: "Text on the dismiss / close button",
    },
    "sdk.modal.dismiss.primaryAction_sharing": {
        label: "Dismiss button (sharing)",
        description: "Dismiss button text during the sharing flow",
    },
    "sdk.modal.final.title": {
        label: "Final step title",
        description: "Heading shown on the last modal step",
    },
    "sdk.modal.final.title_reward": {
        label: "Final step title (reward)",
        description: "Heading when a reward is available",
    },
    "sdk.modal.final.title_sharing": {
        label: "Final step title (sharing)",
        description: "Heading during the sharing flow",
    },
    "sdk.modal.final.description": {
        label: "Final step description",
        description: "Body text on the last modal step",
    },
    "sdk.modal.final.description_sharing": {
        label: "Final step description (sharing)",
        description: "Body text during the sharing flow",
    },
    "sdk.modal.final.description_reward": {
        label: "Final step description (reward)",
        description: "Body text when a reward is available",
    },
    "sdk.modal.final.dismissed.description": {
        label: "Dismissed description",
        description: "Text shown after the user dismissed the modal",
    },
    "sdk.modal.final.dismissed.description_sharing": {
        label: "Dismissed description (sharing)",
        description: "Dismissed text during the sharing flow",
    },
    "sdk.modal.login.description": {
        label: "Login description",
        description: "Body text in the login modal",
    },
    "sdk.modal.login.description_sharing": {
        label: "Login description (sharing)",
        description: "Login body text during the sharing flow",
    },
    "sdk.modal.login.description_reward": {
        label: "Login description (reward)",
        description: "Login body text when a reward is available",
    },
    "sdk.modal.login.primaryAction": {
        label: "Login button",
        description: "Main action button in the login modal",
    },
    "sdk.modal.login.secondaryAction": {
        label: "Secondary button",
        description: "Alternative action button in the login modal",
    },
    "sdk.modal.login.title": {
        label: "Login title",
        description: "Heading of the login modal",
    },
    "sdk.modal.login.success": {
        label: "Login success",
        description: "Message shown after a successful login",
    },
    "sdk.modal.sendTransaction.description": {
        label: "Transaction description",
        description: "Body text in the transaction confirmation modal",
    },
    "sdk.modal.sendTransaction.primaryAction_one": {
        label: "Confirm button (single)",
        description: "Button text when confirming a single transaction",
    },
    "sdk.modal.sendTransaction.primaryAction_other": {
        label: "Confirm button (multiple)",
        description: "Button text when confirming multiple transactions",
    },
    "sdk.modal.sendTransaction.title": {
        label: "Transaction title",
        description: "Heading of the transaction confirmation modal",
    },
    "sdk.modal.siweAuthenticate.description": {
        label: "Authentication description",
        description: "Body text in the SIWE authentication modal",
    },
    "sdk.modal.siweAuthenticate.primaryAction": {
        label: "Authentication button",
        description: "Action button for SIWE authentication",
    },
    "sdk.modal.siweAuthenticate.title": {
        label: "Authentication title",
        description: "Heading of the SIWE authentication modal",
    },
    "sdk.sharingPage.dismiss": {
        label: "Dismiss button",
        description: "Text on the dismiss / later button on the sharing page",
    },
    "sdk.sharingPage.reward.title": {
        label: "Reward title",
        description: "Main heading in the reward card section",
    },
    "sdk.sharingPage.reward.tagline": {
        label: "Reward tagline",
        description:
            "Description below the reward title explaining the sharing incentive",
    },
    "sdk.sharingPage.steps.title": {
        label: "Steps title",
        description: "Heading above the step-by-step instructions",
    },
    "sdk.sharingPage.steps.1": {
        label: "Step 1",
        description: "First step instruction (share in 1 click)",
    },
    "sdk.sharingPage.steps.2": {
        label: "Step 2",
        description: "Second step instruction (earn on every purchase)",
    },
    "sdk.sharingPage.steps.3": {
        label: "Step 3",
        description: "Third step instruction (collect earnings)",
    },
    "sdk.sharingPage.faq.title": {
        label: "FAQ title",
        description: "Heading above the FAQ section",
    },
    "sdk.sharingPage.faq.q1": {
        label: "FAQ question 1",
        description: "First frequently asked question",
    },
    "sdk.sharingPage.faq.a1": {
        label: "FAQ answer 1",
        description: "Answer to the first question",
    },
    "sdk.sharingPage.faq.q2": {
        label: "FAQ question 2",
        description: "Second frequently asked question",
    },
    "sdk.sharingPage.faq.a2": {
        label: "FAQ answer 2",
        description: "Answer to the second question",
    },
    "sdk.sharingPage.faq.q3": {
        label: "FAQ question 3",
        description: "Third frequently asked question",
    },
    "sdk.sharingPage.faq.a3": {
        label: "FAQ answer 3",
        description: "Answer to the third question",
    },
    "sdk.sharingPage.faq.q4": {
        label: "FAQ question 4",
        description: "Fourth frequently asked question",
    },
    "sdk.sharingPage.faq.a4": {
        label: "FAQ answer 4",
        description: "Answer to the fourth question",
    },
    "sdk.sharingPage.faq.q5": {
        label: "FAQ question 5",
        description: "Fifth frequently asked question",
    },
    "sdk.sharingPage.faq.a5": {
        label: "FAQ answer 5",
        description: "Answer to the fifth question",
    },
    "sdk.sharingPage.confirmation.title": {
        label: "Confirmation title",
        description: "Heading shown after a successful share",
    },
    "sdk.sharingPage.confirmation.subtitle": {
        label: "Confirmation subtitle",
        description: "Description below the confirmation title",
    },
    "sdk.sharingPage.confirmation.benefits.wallet.title": {
        label: "Wallet benefit title",
        description: "Title for the wallet creation benefit",
    },
    "sdk.sharingPage.confirmation.benefits.wallet.description": {
        label: "Wallet benefit description",
        description: "Description for the wallet creation benefit",
    },
    "sdk.sharingPage.confirmation.benefits.notify.title": {
        label: "Notification benefit title",
        description: "Title for the earnings notification benefit",
    },
    "sdk.sharingPage.confirmation.benefits.notify.description": {
        label: "Notification benefit description",
        description: "Description for the earnings notification benefit",
    },
    "sdk.sharingPage.confirmation.benefits.cashout.title": {
        label: "Cashout benefit title",
        description: "Title for the cashout benefit",
    },
    "sdk.sharingPage.confirmation.benefits.cashout.description": {
        label: "Cashout benefit description",
        description: "Description for the cashout benefit",
    },
    "sdk.sharingPage.confirmation.cta": {
        label: "Confirmation CTA",
        description: "Call-to-action button text on the confirmation screen",
    },
};

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
