import { currentStablecoins, type Stablecoin } from "@frak-labs/app-essentials";
import type { Currency } from "@frak-labs/core-sdk";
import { formatUnits, maxUint256 } from "viem";
import { getNumberFormat } from "./intlCache";

type CurrencyOption = {
    value: Stablecoin;
    label: string;
    currencySymbol: string;
    currencyCode: string;
    locale: string;
    provider: "Monerium" | "Circle";
};

type CurrencyGroup = {
    group: string;
    description: string;
    options: readonly CurrencyOption[];
};

export const currencyOptions: readonly CurrencyGroup[] = [
    {
        group: "Monerium",
        description: "Euros, sent to a bank account",
        options: [
            {
                value: "eure",
                label: "EUR",
                currencySymbol: "EUR",
                currencyCode: "EUR",
                locale: "fr-FR",
                provider: "Monerium",
            },
        ],
    },
    {
        group: "Circle",
        description: "US dollars, spent in crypto apps",
        options: [
            {
                value: "usdc",
                label: "USD",
                currencySymbol: "USD",
                currencyCode: "USD",
                locale: "en-US",
                provider: "Circle",
            },
        ],
    },
] as const;

export const currencyMetadata: Record<Stablecoin, CurrencyOption> =
    currencyOptions.reduce(
        (acc, group) => {
            for (const option of group.options) {
                acc[option.value] = option;
            }
            return acc;
        },
        {} as Record<Stablecoin, CurrencyOption>
    );

/**
 * Format a token balance as a human-readable currency string
 * e.g. 5000000000n + "eure" → "5 000 €"
 */
export function formatTokenBalance(
    balance: bigint,
    stablecoin: Stablecoin,
    decimals: number
): string {
    if (balance === maxUint256) return "∞";

    const meta = currencyMetadata[stablecoin];
    const numeric = Number(formatUnits(balance, decimals));
    return getNumberFormat(meta.locale, {
        style: "currency",
        currency: meta.currencyCode,
        maximumFractionDigits: numeric % 1 !== 0 ? 2 : 0,
    }).format(numeric);
}

/**
 * Resolve a token address to its Currency code (e.g. "eur", "usd", "gbp")
 */
function tokenAddressToCurrency(
    tokenAddress: string | undefined
): Currency | undefined {
    if (!tokenAddress) return undefined;
    for (const [key, address] of Object.entries(currentStablecoins)) {
        if (address.toLowerCase() === tokenAddress.toLowerCase()) {
            const meta = currencyMetadata[key as Stablecoin];
            return meta?.currencyCode.toLowerCase() as Currency;
        }
    }
    return undefined;
}

/** Monetary glyph per ISO currency code (USDC shares the USD "$" glyph). */
const CURRENCY_GLYPHS: Record<string, string> = {
    eur: "€",
    gbp: "£",
    usd: "$",
};

/**
 * Resolve a reward-token address to its display glyph (€ / £ / $). Falls back
 * to € for an unknown/undefined token (e.g. a merchant default from another
 * environment), matching the historical hardcoded default.
 */
export function tokenAddressToCurrencyGlyph(
    tokenAddress: string | undefined
): string {
    const currency = tokenAddressToCurrency(tokenAddress);
    return (currency && CURRENCY_GLYPHS[currency]) || "€";
}
