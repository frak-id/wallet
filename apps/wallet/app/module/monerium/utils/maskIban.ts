/**
 * Mask an IBAN string for display, showing only the last 4 characters
 * after a row of bullets — matches Figma's `639:22528` "**** 154"-style
 * recap row, but with 4 trailing chars (vs Figma's 3) for slightly
 * better disambiguation when a user has several accounts.
 *
 * @example maskIban("FR7630006000011234567890189") → "•••• 0189"
 */
export function maskIban(iban: string): string {
    const cleaned = iban.replace(/\s/g, "");
    if (cleaned.length <= 4) return cleaned;
    return `•••• ${cleaned.slice(-4)}`;
}

/**
 * Shorten an IBAN for log messages or compact display,
 * showing the first 4 and last 4 characters with an ellipsis.
 *
 * @example shortenIban("FR7630006000011234567890189") → "FR76...0189"
 */
export function shortenIban(iban: string): string {
    const cleaned = iban.replace(/\s/g, "");
    if (cleaned.length <= 11) return cleaned;
    return `${cleaned.substring(0, 4)}...${cleaned.substring(cleaned.length - 4)}`;
}
