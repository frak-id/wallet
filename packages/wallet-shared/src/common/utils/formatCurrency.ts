import {
    type Currency,
    formatAmount,
    formatAmountParts,
    getSupportedCurrency,
    getSupportedLocale,
} from "@frak-labs/core-sdk";

/**
 * fr-FR groups digits with U+202F, which Inter draws about 0.12em wide: next
 * to bold digits `1 234` reads as `1234`. U+00A0 keeps the no-wrap and the gap.
 */
export function widenGroupSeparator(formatted: string): string {
    return formatted.replaceAll("\u202f", "\u00a0");
}

/** `1 000–5 000 €`: the lower bound in the same locale, without the symbol. */
export function formatAmountRange(
    min: number,
    max: number,
    currency?: Currency
): string {
    const { integer, decimals } = formatAmountParts(min, currency);
    const whole = Number.isInteger(Math.round(min * 100) / 100);
    const from = whole ? integer : `${integer}${decimals}`;
    return `${from}–${formatAmount(max, currency)}`;
}

/** A reward value: whole amounts stay bare (`10 €`), others keep both cents (`£8.70`, never `£8.7`). */
export function formatRewardAmount(
    amount: number,
    currency?: Currency
): string {
    const rounded = Math.round(amount * 100) / 100;
    if (Number.isInteger(rounded)) return formatAmount(rounded, currency);
    return widenGroupSeparator(
        rounded.toLocaleString(getSupportedLocale(currency), {
            style: "currency",
            currency: getSupportedCurrency(currency),
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    );
}

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
    return widenGroupSeparator(
        new Intl.NumberFormat(locale, {
            style: "currency",
            currency,
            ...(amount === 0 && {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }),
        }).format(amount)
    );
}
