import { type Currency, formatAmount } from "@frak-labs/core-sdk";
import { Fragment } from "react";

/**
 * Replace {{ estimatedReward }} and {{ productName }} with display values
 */
export function replaceVariables(
    text: string,
    currency: Currency,
    shopName: string
): string {
    if (!text) return "";
    return text
        .replace(/\{\{\s*estimatedReward\s*\}\}/g, formatAmount(42, currency))
        .replace(/\{\{\s*productName\s*\}\}/g, shopName);
}

/**
 * Parse markdown text (bold/italic) and replace {{ estimatedReward }} with formatted amount
 */
export function parseMarkdown(
    text: string,
    currency: Currency
): React.ReactNode[] {
    if (!text) return [];

    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let keyCounter = 0;

    // Replace {{ estimatedReward }} with formatted amount
    const processedText = text.replace(
        /\{\{\s*estimatedReward\s*\}\}/g,
        formatAmount(42, currency)
    );

    // Match **bold** and *italic* text
    const markdownRegex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
    const matches = Array.from(processedText.matchAll(markdownRegex));

    for (const match of matches) {
        if (match.index !== undefined && match.index > currentIndex) {
            parts.push(
                <Fragment key={`text-${keyCounter++}`}>
                    {processedText.slice(currentIndex, match.index)}
                </Fragment>
            );
        }

        if (match[0].startsWith("**")) {
            parts.push(
                <strong key={`bold-${keyCounter++}`}>{match[2]}</strong>
            );
        } else if (match[0].startsWith("*")) {
            parts.push(<em key={`italic-${keyCounter++}`}>{match[3]}</em>);
        }

        currentIndex = (match.index || 0) + match[0].length;
    }

    if (currentIndex < processedText.length) {
        parts.push(
            <Fragment key={`text-${keyCounter++}`}>
                {processedText.slice(currentIndex)}
            </Fragment>
        );
    }

    return parts;
}
