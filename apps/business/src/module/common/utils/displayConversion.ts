import { getStablecoinCurrency } from "@frak-labs/app-essentials";
import { type Currency, getSupportedCurrency } from "@frak-labs/core-sdk";
import { getNumberFormat } from "./intlCache";

type TokenRates = Partial<Record<Currency, number>>;

/** Fiat a reward token pays in; EUR for an unknown token, like the amount glyphs. */
export function resolvePayoutCurrency(tokenAddress?: string): Currency {
    return getStablecoinCurrency(tokenAddress) ?? "eur";
}

/** Fiat the SDK shows visitors: what `setupClient` resolves a missing or unsupported currency to. */
export function resolveDisplayCurrency(configured?: unknown): Currency {
    return getSupportedCurrency(
        typeof configured === "string" && configured
            ? (configured as Currency)
            : undefined
    );
}

/** Value of one payout-fiat unit in the display fiat, from the token's per-fiat prices. */
export function conversionRate(
    rates: TokenRates | null | undefined,
    displayCurrency: Currency,
    payoutCurrency: Currency
): number | undefined {
    const display = rates?.[displayCurrency];
    const payout = rates?.[payoutCurrency];
    if (!display || !payout) return undefined;
    return display / payout;
}

export function formatFiat(
    value: number,
    currency: Currency,
    locale: string,
    fractionDigits: [min: number, max: number] = [0, 2]
): string {
    return getNumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: fractionDigits[0],
        maximumFractionDigits: fractionDigits[1],
    }).format(value);
}

/** `"€1 = £0.87"` */
export function formatConversionRate(
    rate: number,
    displayCurrency: Currency,
    payoutCurrency: Currency,
    locale: string
): string {
    const display = formatFiat(rate, displayCurrency, locale, [
        2,
        rate < 0.1 ? 4 : 2,
    ]);
    return `${formatFiat(1, payoutCurrency, locale, [0, 0])} = ${display}`;
}
