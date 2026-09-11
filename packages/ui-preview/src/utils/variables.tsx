import { type Currency, formatAmount } from "@frak-labs/core-sdk";

export function replaceVariables(
    text: string,
    currency: Currency,
    shopName: string
): string {
    if (!text) return "";
    const formattedAmount = formatAmount(42, currency);
    return text
        .replace(/\{\{\s*estimatedReward\s*\}\}/g, formattedAmount)
        .replace(/\{REWARD\}/g, formattedAmount)
        .replace(/\{\{\s*productName\s*\}\}/g, shopName);
}
