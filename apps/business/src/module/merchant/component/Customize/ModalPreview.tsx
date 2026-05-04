import { SharingPreview, SharingSuccessPreview } from "@frak-labs/ui-preview";
import type { UseFormReturn } from "react-hook-form";
import { PreviewWrapper } from "@/module/common/component/PreviewWrapper";
import styles from "./ModalPreview.module.css";
import {
    TRANSLATION_LANG_FIELDS,
    type TranslationFormValues,
    type TranslationLang,
} from "./utils";

/**
 * Default translations used when no custom value is set.
 * Sourced from wallet-shared/src/i18n/locales/en/customized.json + translation.json.
 */
const DEFAULTS: Record<string, string> = {
    "sdk.sharingPage.dismiss": "Later",
    "sdk.sharingPage.reward.title": "Share with your friends",
    "sdk.sharingPage.reward.tagline":
        "You earn a reward every time a friend makes a purchase through your link.",
    "sdk.sharingPage.card.amount": "5,00 €",
    "sdk.sharingPage.card.label": "Credited to your account",
    "sdk.sharingPage.card.tagline1": "Earn 5€,",
    "sdk.sharingPage.card.tagline2": "on every purchase!",
    "sdk.sharingPage.steps.1":
        "Share in 1 click. A personal link is automatically generated with each share.",
    "sdk.sharingPage.steps.2":
        "Earn on every purchase. Every order placed through your link earns you cash.",
    "sdk.sharingPage.steps.3":
        "Collect your earnings in the app. Install FRAK to collect your earnings.",
    "sharing.btn.share": "Share",
    "sharing.btn.copy": "Copy link",
    "sdk.sharingPage.confirmation.title":
        "Thank you for sharing!\nDon't miss out on your reward.",
    "sdk.sharingPage.confirmation.subtitle":
        "Install the Frak app and track your earnings in real time.",
    "sdk.sharingPage.confirmation.cardPopupTitle": "You just won! 🎉",
    "sdk.sharingPage.confirmation.cardPopupDescription":
        "A purchase was made through your link.",
    "sdk.sharingPage.confirmation.benefits.wallet.title":
        "Your wallet secured in 10 seconds",
    "sdk.sharingPage.confirmation.benefits.wallet.description":
        "No email, no password, no form. Simple, fast and secure.",
    "sdk.sharingPage.confirmation.benefits.notify.title":
        "Get notified as soon as you earn",
    "sdk.sharingPage.confirmation.benefits.notify.description":
        "Receive a notification when a purchase is made thanks to you.",
    "sdk.sharingPage.confirmation.benefits.cashout.title":
        "Cash out whenever you want",
    "sdk.sharingPage.confirmation.benefits.cashout.description":
        "Transfer your earnings directly to your bank account in 3 clicks.",
    "sdk.sharingPage.confirmation.cta": "Collect my reward",
    "sdk.sharingPage.confirmation.shareAgain": "Share again",
    "sdk.sharingPage.legal.help": "Help",
    "sdk.sharingPage.legal.privacy": "Privacy notice",
    "sdk.sharingPage.legal.terms": "Terms & conditions",
};

function getNestedValue(obj: unknown, path: string[]): string | undefined {
    let current = obj;
    for (const part of path) {
        if (!current) return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    if (current && typeof current === "string" && current.trim() !== "") {
        return current;
    }
    return undefined;
}

function resolveTranslation(
    key: string,
    lang: TranslationLang,
    formValues: TranslationFormValues,
    inheritedValues?: TranslationFormValues
): string | undefined {
    const parts = key.split(".");
    const activeField = TRANSLATION_LANG_FIELDS[lang];
    const defaultField = TRANSLATION_LANG_FIELDS.default;

    const sources =
        lang === "default"
            ? [formValues[activeField], inheritedValues?.[activeField]]
            : [
                  formValues[activeField],
                  formValues[defaultField],
                  inheritedValues?.[activeField],
                  inheritedValues?.[defaultField],
              ];

    for (const source of sources) {
        const value = getNestedValue(source, parts);
        if (value) return value;
    }

    return undefined;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
    eur: "€",
    usd: "$",
    gbp: "£",
};

type SharingPagePreviewProps = {
    form: UseFormReturn<TranslationFormValues>;
    logoUrl?: string;
    currency?: string;
    lang: TranslationLang;
    defaultValues?: TranslationFormValues;
};

export function SharingPagePreview({
    form,
    logoUrl,
    currency,
    lang,
    defaultValues,
}: SharingPagePreviewProps) {
    const watchedValues = form.watch();
    const symbol = CURRENCY_SYMBOLS[currency ?? "eur"] ?? "€";
    const estimatedReward = `5,00 ${symbol}`;

    const t = (key: string) => {
        const raw =
            resolveTranslation(key, lang, watchedValues, defaultValues) ??
            DEFAULTS[key] ??
            key;
        return raw
            .replace(/\{\{\s*estimatedReward\s*\}\}/g, estimatedReward)
            .replace(/\{\{\s*productName\s*\}\}/g, "My Store");
    };

    return (
        <PreviewWrapper>
            <div className={styles.previewContainer}>
                <div className={styles.previewColumn}>
                    <div>
                        <h4 className={styles.previewTitle}>Sharing page</h4>
                        <p className={styles.previewDescription}>
                            Shown when a visitor clicks the share button
                        </p>
                    </div>
                    <SharingPreview t={t} logoUrl={logoUrl} />
                </div>
                <div className={styles.previewColumn}>
                    <div>
                        <h4 className={styles.previewTitle}>
                            Post-share success
                        </h4>
                        <p className={styles.previewDescription}>
                            Shown after a successful share action
                        </p>
                    </div>
                    <SharingSuccessPreview t={t} logoUrl={logoUrl} />
                </div>
            </div>
        </PreviewWrapper>
    );
}
