import { currentStablecoins } from "@frak-labs/app-essentials";
import type { BalanceItem, RampOfframpSource } from "@frak-labs/wallet-shared";
import { type Address, isAddressEqual } from "viem";

type SourceToken = { address: Address; decimals: number; currency: string };

export const SOURCE_TOKENS = {
    eure: { address: currentStablecoins.eure, decimals: 18, currency: "EUR" },
    usdc: { address: currentStablecoins.usdc, decimals: 6, currency: "USD" },
} as const satisfies Record<RampOfframpSource, SourceToken>;

export function getSourceToken(source: RampOfframpSource): SourceToken {
    return SOURCE_TOKENS[source];
}

/** Floored to cents so the displayed balance is never above what is sendable. */
export function getSourceBalance(
    balances: BalanceItem[] | undefined,
    source: RampOfframpSource
): number {
    const { address } = getSourceToken(source);
    const raw =
        balances?.find((b) => isAddressEqual(b.token, address))?.amount ?? 0;
    return Math.floor(Number((raw * 100).toFixed(6))) / 100;
}
