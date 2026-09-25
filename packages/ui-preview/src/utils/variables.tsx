import { type Currency, formatAmount } from "@frak-labs/core-sdk";

/** Sample reward the previews show in place of `{REWARD}`. */
export const SAMPLE_AMOUNT = 42;

export function replaceVariables(
    text: string,
    currency: Currency,
    shopName: string,
    amount = SAMPLE_AMOUNT
): string {
    if (!text) return "";
    const formattedAmount = formatAmount(amount, currency);
    return text
        .replace(/\{\{\s*estimatedReward\s*\}\}/g, formattedAmount)
        .replace(/\{REWARD\}/g, formattedAmount)
        .replace(/\{BRAND\}/g, () => shopName)
        .replace(/\{\{\s*productName\s*\}\}/g, shopName);
}
