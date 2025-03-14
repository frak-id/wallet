/**
 * The keys for each locales
 * @inline
 */
export type LocalesKey = keyof typeof locales;

/**
 * Map the currency to the locale
 */
export const locales = {
    eur: "fr-FR",
    usd: "en-US",
    gbp: "en-GB",
} as const;
