/**
 * Format a number as a localized currency string.
 *
 * Uses Intl.NumberFormat so the decimal/thousand separators, symbol position
 * and rounding follow the user's locale (e.g. `1,64 €` in fr-FR vs `€1.64`
 * in en-US).
 *
 * Zero values are formatted without fraction digits (e.g. `0 €` instead of
 * `0,00 €`) for a cleaner empty state.
 */
export function formatCurrency(
    amount: number,
    currency: string,
    locale: string
): string {
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        ...(amount === 0 && {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }),
    }).format(amount);
}
