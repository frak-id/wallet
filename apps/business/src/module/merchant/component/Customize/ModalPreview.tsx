import type { Currency } from "@frak-labs/core-sdk";
import { ModalPreview } from "@frak-labs/ui-preview";
import type { UseFormReturn } from "react-hook-form";
import styles from "./ModalPreview.module.css";
import {
    TRANSLATION_LANG_FIELDS,
    type TranslationFormValues,
    type TranslationLang,
} from "./utils";

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

type LoginPreviewProps = {
    form: UseFormReturn<TranslationFormValues>;
    logoUrl?: string;
    currency?: string;
    lang: TranslationLang;
    defaultValues?: TranslationFormValues;
};

export function LoginPreview({
    form,
    logoUrl,
    currency,
    lang,
    defaultValues,
}: LoginPreviewProps) {
    const watchedValues = form.watch();

    const getValue = (key: string) =>
        resolveTranslation(key, lang, watchedValues, defaultValues);

    const standardText =
        getValue("sdk.wallet.login.text") || "Connect your wallet to continue";
    const referredText =
        getValue("sdk.wallet.login.text_referred") ||
        "Connect your wallet to claim your {{ estimatedReward }} reward";
    const buttonText =
        getValue("sdk.wallet.login.primaryAction") || "Connect Wallet";

    return (
        <div className={styles.previewContainer}>
            <div className={styles.previewColumn}>
                <div>
                    <h4 className={styles.previewTitle}>Standard visitor</h4>
                    <p className={styles.previewDescription}>
                        Shown to users who visit your site directly
                    </p>
                </div>
                <ModalPreview
                    text={standardText}
                    buttonLabel={buttonText}
                    logoUrl={logoUrl}
                    currency={(currency ?? "usd") as Currency}
                />
            </div>
            <div className={styles.previewColumn}>
                <div>
                    <h4 className={styles.previewTitle}>Referred visitor</h4>
                    <p className={styles.previewDescription}>
                        Shown to users who arrive via a referral link
                    </p>
                </div>
                <ModalPreview
                    text={referredText}
                    buttonLabel={buttonText}
                    logoUrl={logoUrl}
                    currency={(currency ?? "usd") as Currency}
                />
            </div>
        </div>
    );
}
