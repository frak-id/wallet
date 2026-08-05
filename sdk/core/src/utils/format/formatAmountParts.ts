import type { Currency } from "../../types";
import { getSupportedCurrency } from "./getSupportedCurrency";
import { getSupportedLocale } from "./getSupportedLocale";

/**
 * A formatted amount, pre-split into the pieces a display surface styles
 * differently.
 *
 * Exists so surfaces stop re-parsing an already-formatted string to find its
 * decimals and its symbol. The sharing page's hero "credit card" renders the
 * integer large and the decimals + symbol small; deriving that from the string
 * meant a regex that had to know every locale's separators, and that knowledge
 * was duplicated in two places.
 *
 * `unitPosition` is what makes this locale-safe rather than merely convenient:
 * `fr-FR` puts the symbol last (`"12,50 €"`) and `en-US` puts it first
 * (`"$12.50"`), and a surface cannot assume either.
 */
export type RewardAmountParts = {
    /** Integer digits with their locale group separators, e.g. `"1 500"`. */
    integer: string;
    /**
     * Decimal separator plus fraction digits, e.g. `",50"`.
     *
     * Always present for a money amount, synthesised as `",00"` when the
     * amount is whole — the credit-card treatment always shows two decimals,
     * and the alternative was the caller defaulting it and re-deriving the
     * separator. Absent for a percentage, which has no fraction to show.
     */
    decimals?: string;
    /** Currency symbol or `"%"`. */
    unit: string;
    unitPosition: "prefix" | "suffix";
};

/**
 * The locale's decimal separator, read from the formatter rather than assumed.
 */
function decimalSeparator(formatter: Intl.NumberFormat): string {
    return (
        formatter.formatToParts(1.1).find((part) => part.type === "decimal")
            ?.value ?? "."
    );
}

/**
 * Split a money amount into display parts, using the same locale, currency and
 * fraction-digit options as {@link formatAmount} so the two can never disagree
 * about what the number looks like.
 */
export function formatAmountParts(
    amount: number,
    currency?: Currency
): RewardAmountParts {
    const supportedLocale = getSupportedLocale(currency);
    const supportedCurrency = getSupportedCurrency(currency);

    const formatter = new Intl.NumberFormat(supportedLocale, {
        style: "currency",
        currency: supportedCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
    const parts = formatter.formatToParts(amount);

    let integer = "";
    let fraction = "";
    let unit = "";
    let unitPosition: RewardAmountParts["unitPosition"] = "suffix";
    let seenInteger = false;

    for (const part of parts) {
        switch (part.type) {
            case "integer":
            case "group":
                integer += part.value;
                seenInteger = true;
                break;
            case "decimal":
            case "fraction":
                fraction += part.value;
                break;
            case "currency":
                unit = part.value;
                // A symbol seen before any digit leads the number.
                unitPosition = seenInteger ? "suffix" : "prefix";
                break;
            default:
                // `literal` is the spacing between number and symbol, which the
                // consumer re-creates with its own styling.
                break;
        }
    }

    return {
        integer,
        decimals: fraction || `${decimalSeparator(formatter)}00`,
        unit,
        unitPosition,
    };
}

/**
 * Split a percentage reward into display parts.
 *
 * Built by hand rather than through `Intl`, mirroring the string side: the
 * backend sends a whole percent (`10` meaning `"10 %"`), while
 * `Intl.NumberFormat` with `style: "percent"` expects a fraction and applies
 * its own rounding. Routing this through `Intl` would change what the golden
 * reward fixtures produce, which would be a behaviour change wearing a
 * refactor's clothes.
 */
export function percentAmountParts(percent: number): RewardAmountParts {
    return {
        integer: String(percent),
        unit: "%",
        unitPosition: "suffix",
    };
}
