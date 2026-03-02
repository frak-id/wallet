import { type Currency, formatAmount } from "@frak-labs/core-sdk";
import type { loader as rootLoader } from "app/routes/app";
import { Fragment } from "react";
import { useRouteLoaderData } from "react-router";
import styles from "./index.module.css";

type ModalPreviewProps = {
    text?: string;
    button?: string;
    logoUrl?: string;
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

export function ModalPreview({ text, button, logoUrl }: ModalPreviewProps) {
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const currency = (rootData?.shop?.preferredCurrency ?? "usd") as Currency;

    const parsedText = text ? parseMarkdown(text, currency) : null;

    return (
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
    );
}
