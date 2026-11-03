/**
 * Mask an IBAN string for display, showing only the last 4 characters
 * after a row of bullets — a "**** 154"-style recap row, but with 4
 * trailing chars (vs the design's 3) for slightly better disambiguation
 * when a user has several accounts.
 *
 * @example maskIban("FR7630006000011234567890189") → "•••• 0189"
 */
export function maskIban(iban: string): string {
    const cleaned = iban.replace(/\s/g, "");
    if (cleaned.length <= 4) return cleaned;
    return `•••• ${cleaned.slice(-4)}`;
}
