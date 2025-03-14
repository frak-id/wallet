import { type LocalesKey, locales } from "../constants/locales";
import type { Currency } from "../types";

/**
 * Get the supported locale for a given currency
 * @param currency - The currency to use
 * @returns The supported locale
 */
export function getSupportedLocale(
    currency?: Currency
): (typeof locales)[LocalesKey] {
    if (!currency) {
        return locales.eur;
    }
    return locales[currency] ?? locales.eur;
}
