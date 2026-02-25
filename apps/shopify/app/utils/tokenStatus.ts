import type { Stablecoin } from "@frak-labs/app-essentials";
import { formatUnits } from "viem";

type CurrencyMeta = {
    label: string;
    currencySymbol: string;
    currencyCode: string;
    locale: string;
    provider: string;
    providerDescription: string;
};

export const currencyMetadata: Record<Stablecoin, CurrencyMeta> = {
    eure: {
        label: "EURe",
        currencySymbol: "EUR",
        currencyCode: "EUR",
        locale: "fr-FR",
        provider: "Monerium",
        providerDescription:
            "Instant bank transfer — users can withdraw rewards to their IBAN in seconds",
    },
    gbpe: {
        label: "GBPe",
        currencySymbol: "GBP",
        currencyCode: "GBP",
        locale: "en-GB",
        provider: "Monerium",
        providerDescription:
            "Instant bank transfer — users can withdraw rewards to their IBAN in seconds",
    },
    usde: {
        label: "USDe",
        currencySymbol: "USD",
        currencyCode: "USD",
        locale: "en-US",
        provider: "Monerium",
        providerDescription:
            "Instant bank transfer — users can withdraw rewards to their IBAN in seconds",
    },
    usdc: {
        label: "USDC",
        currencySymbol: "USDC",
        currencyCode: "USD",
        locale: "en-US",
        provider: "Circle",
        providerDescription:
            "Widely accepted digital dollar — users can spend rewards across apps and services",
    },
};

/**
 * Determine the status of a token based on its balance and allowance.
 *
 * - empty: no balance at all
 * - paused: has balance but no allowance (rewards paused for this token)
 * - warning: allowance is less than balance (will run out soon)
 * - active: allowance >= balance (fully authorized)
 */
export function getTokenStatus(balance: bigint, allowance: bigint) {
    if (balance === 0n) return "empty" as const;
    if (allowance === 0n) return "paused" as const;
    if (allowance < balance) return "warning" as const;
    return "active" as const;
}

export type TokenStatus = ReturnType<typeof getTokenStatus>;

export function formatTokenBalance(
    balance: bigint,
    stablecoin: Stablecoin,
    decimals: number
): string {
    const meta = currencyMetadata[stablecoin];
    const numeric = Number(formatUnits(balance, decimals));
    return new Intl.NumberFormat(meta.locale, {
        style: "currency",
        currency: meta.currencyCode,
        maximumFractionDigits: numeric % 1 !== 0 ? 2 : 0,
    }).format(numeric);
}
