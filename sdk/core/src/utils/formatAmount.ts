import type { Currency } from "../types";
import { getSupportedCurrency } from "./getSupportedCurrency";
import { getSupportedLocale } from "./getSupportedLocale";

/**
 * Format a numeric amount as a localized currency string
 * @param amount - The raw numeric amount to format
 * @param currency - Optional currency config; defaults to EUR/fr-FR when omitted
 * @returns Localized currency string (e.g. "1 500 €", "$1,500")
 */
export function formatAmount(amount: number, currency?: Currency) {
    // Get the supported locale (e.g. "fr-FR")
    const supportedLocale = getSupportedLocale(currency);

    // Get the supported currency (e.g. "eur")
    const supportedCurrency = getSupportedCurrency(currency);

    return amount.toLocaleString(supportedLocale, {
        style: "currency",
        currency: supportedCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}
