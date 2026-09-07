import type { Currency } from "../../types";
import { getSupportedCurrency } from "./getSupportedCurrency";
import { getSupportedLocale } from "./getSupportedLocale";

/**
 * A formatted amount, pre-split into the pieces a display surface styles
 * differently. `unitPosition` keeps it locale-safe: `fr-FR` puts the symbol
 * last (`"12,50 €"`), `en-US` first (`"$12.50"`).
 */
export type RewardAmountParts = {
    /** Integer digits with their locale group separators, e.g. `"1 500"`. */
    integer: string;
    /**
     * Decimal separator plus fraction digits, e.g. `",50"`. Synthesised as
     * `",00"` for a whole amount; absent for a percentage.
     */
    decimals?: string;
    /** Currency symbol or `"%"`. */
    unit: string;
    unitPosition: "prefix" | "suffix";
};

function decimalSeparator(formatter: Intl.NumberFormat): string {
    return (
        formatter.formatToParts(1.1).find((part) => part.type === "decimal")
            ?.value ?? "."
    );
}

/**
 * Split a money amount into display parts, using the same options as
 * {@link formatAmount} so the two can never disagree about the number.
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
                // `literal` is spacing the consumer re-creates itself.
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
 * Split a percentage reward into display parts. Built by hand: the backend
 * sends a whole percent, which `Intl`'s `style: "percent"` would rescale.
 */
export function percentAmountParts(percent: number): RewardAmountParts {
    return {
        integer: String(percent),
        unit: "%",
        unitPosition: "suffix",
    };
}
