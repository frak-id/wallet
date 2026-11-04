/** `•••• 0143`: the last four characters, as the wallet's `maskIban` shows an IBAN. */
export function maskIban(iban: string): string {
    const cleaned = iban.replace(/\s/g, "");
    if (cleaned.length <= 4) return cleaned;
    return `•••• ${cleaned.slice(-4)}`;
}
