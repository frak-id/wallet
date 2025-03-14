import { locales } from "../constants/locales";
import type { Currency } from "../types";

/**
 * Get the supported currency for a given currency
 * @param currency - The currency to use
 * @returns The supported currency
 */
export function getSupportedCurrency(currency?: Currency): Currency {
    if (!currency) {
        return "eur";
    }
    return currency in locales ? currency : "eur";
}
