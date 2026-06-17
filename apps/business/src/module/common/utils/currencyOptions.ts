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
    providerDescription: string;
};

type CurrencyGroup = {
    group: string;
    description: string;
    options: readonly CurrencyOption[];
};

export const currencyOptions: readonly CurrencyGroup[] = [
    {
        group: "Monerium",
        description: "Best for easy IBAN transfer for end users",
        options: [
            {
                value: "eure",
                label: "EURe",
                currencySymbol: "EUR",
                currencyCode: "EUR",
                locale: "fr-FR",
                provider: "Monerium",
                providerDescription:
                    "Instant bank transfer — users can withdraw rewards to their IBAN in seconds",
            },
            {
                value: "gbpe",
                label: "GBPe",
                currencySymbol: "GBP",
                currencyCode: "GBP",
                locale: "en-GB",
                provider: "Monerium",
                providerDescription:
                    "Instant bank transfer — users can withdraw rewards to their IBAN in seconds",
            },
            {
                value: "usde",
                label: "USDe",
                currencySymbol: "USD",
                currencyCode: "USD",
                locale: "en-US",
                provider: "Monerium",
                providerDescription:
                    "Instant bank transfer — users can withdraw rewards to their IBAN in seconds",
            },
        ],
    },
    {
        group: "Circle",
        description: "Best for blockchain usage for end users",
        options: [
            {
                value: "usdc",
                label: "USDC",
                currencySymbol: "USDC",
                currencyCode: "USD",
                locale: "en-US",
                provider: "Circle",
                providerDescription:
                    "Widely accepted digital dollar — users can spend rewards across apps and services",
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
export function tokenAddressToCurrency(
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
