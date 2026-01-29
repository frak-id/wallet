import type { Stablecoin } from "@frak-labs/app-essentials";
import { formatUnits } from "viem";

type StablecoinMeta = {
    label: string;
    currencySymbol: string;
    currencyCode: string;
    locale: string;
    provider: "Monerium" | "Circle";
    providerDescription: string;
    decimals: number;
};

export const stablecoinMetadata: Record<Stablecoin, StablecoinMeta> = {
    eure: {
        label: "EURe",
        currencySymbol: "EUR",
        currencyCode: "EUR",
        locale: "fr-FR",
        provider: "Monerium",
        providerDescription:
            "Instant bank transfer — users can withdraw rewards to their IBAN in seconds",
        decimals: 6,
    },
    gbpe: {
        label: "GBPe",
        currencySymbol: "GBP",
        currencyCode: "GBP",
        locale: "en-GB",
        provider: "Monerium",
        providerDescription:
            "Instant bank transfer — users can withdraw rewards to their IBAN in seconds",
        decimals: 6,
    },
    usde: {
        label: "USDe",
        currencySymbol: "USD",
        currencyCode: "USD",
        locale: "en-US",
        provider: "Monerium",
        providerDescription:
            "Instant bank transfer — users can withdraw rewards to their IBAN in seconds",
        decimals: 6,
    },
    usdc: {
        label: "USDC",
        currencySymbol: "USDC",
        currencyCode: "USD",
        locale: "en-US",
        provider: "Circle",
        providerDescription:
            "Widely accepted digital dollar — users can spend rewards across apps and services",
        decimals: 6,
    },
};

/**
 * Format a token balance as a human-readable currency string
 * e.g. 5000000000n + "eure" → "5 000 €"
 */
export function formatTokenBalance(
    balance: bigint,
    stablecoin: Stablecoin
): string {
    const meta = stablecoinMetadata[stablecoin];
    const numeric = Number(formatUnits(balance, meta.decimals));
    return new Intl.NumberFormat(meta.locale, {
        style: "currency",
        currency: meta.currencyCode,
        maximumFractionDigits: numeric % 1 !== 0 ? 2 : 0,
    }).format(numeric);
}
