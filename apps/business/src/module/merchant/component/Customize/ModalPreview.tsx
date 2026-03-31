import { type Currency, formatAmount } from "@frak-labs/core-sdk";
import { Fragment } from "react";
import type { UseFormReturn } from "react-hook-form";
import styles from "./ModalPreview.module.css";
import {
    TRANSLATION_LANG_FIELDS,
    type TranslationFormValues,
    type TranslationLang,
} from "./utils";

type PreviewCardProps = {
    title: string;
    description: string;
    text?: string;
    button?: string;
    logoUrl?: string;
    currency?: string;
};

/**
 * Parse markdown text and replace {{ estimatedReward }} with formatted amount
 * @param text - The text to parse
 * @param currency - The currency to format the amount in
 * @returns The parsed text with formatted amounts
 */
function parseMarkdown(text: string, currency: Currency): React.ReactNode[] {
    if (!text) return [];

    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let keyCounter = 0;

    // First replace {{ estimatedReward }} with formatted amount
    const processedText = text.replace(
        /\{\{\s*estimatedReward\s*\}\}/g,
        formatAmount(42, currency)
    );

    // Regular expression to match **bold** and *italic* text
    const markdownRegex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
    const matches = Array.from(processedText.matchAll(markdownRegex));

    for (const match of matches) {
        // Add text before the match
        if (match.index !== undefined && match.index > currentIndex) {
            parts.push(
                <Fragment key={`text-${keyCounter++}`}>
                    {processedText.slice(currentIndex, match.index)}
                </Fragment>
            );
        }

        // Add the formatted text
        if (match[0].startsWith("**")) {
            // Bold text
            parts.push(
                <strong key={`bold-${keyCounter++}`}>{match[2]}</strong>
            );
        } else if (match[0].startsWith("*")) {
            // Italic text
            parts.push(<em key={`italic-${keyCounter++}`}>{match[3]}</em>);
        }

        currentIndex = (match.index || 0) + match[0].length;
    }

    // Add remaining text
    if (currentIndex < processedText.length) {
        parts.push(
            <Fragment key={`text-${keyCounter++}`}>
                {processedText.slice(currentIndex)}
            </Fragment>
        );
    }

    return parts;
}

function PreviewCard({
    title,
    description,
    text,
    button,
    logoUrl,
    currency = "usd",
}: PreviewCardProps) {
    const parsedText = text ? parseMarkdown(text, currency as Currency) : null;

    return (
        <div className={styles.previewColumn}>
            <div>
                <h4 className={styles.previewTitle}>{title}</h4>
                <p className={styles.previewDescription}>{description}</p>
            </div>
            <div className={styles.modalPreview}>
                <div className={styles.header}>
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className={styles.logo} />
                    ) : (
                        <span className={styles.headerText}>Logo</span>
                    )}
                </div>
                <p className={styles.text}>
                    {parsedText && parsedText.length > 0 ? parsedText : text}
                </p>
                <button type="button" className={styles.button}>
                    {button}
                </button>
            </div>
        </div>
    );
}

type LoginPreviewProps = {
    form: UseFormReturn<TranslationFormValues>;
    logoUrl?: string;
    currency?: string;
    lang: TranslationLang;
    defaultValues?: TranslationFormValues;
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
            <PreviewCard
                title="Standard visitor"
                description="Shown to users who visit your site directly"
                text={standardText}
                button={buttonText}
                logoUrl={logoUrl}
                currency={currency}
            />
            <PreviewCard
                title="Referred visitor"
                description="Shown to users who arrive via a referral link"
                text={referredText}
                button={buttonText}
                logoUrl={logoUrl}
                currency={currency}
            />
        </div>
    );
}
