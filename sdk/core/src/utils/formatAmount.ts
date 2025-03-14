import type { Currency } from "../types";
import { getSupportedCurrency } from "./getSupportedCurrency";
import { getSupportedLocale } from "./getSupportedLocale";

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
