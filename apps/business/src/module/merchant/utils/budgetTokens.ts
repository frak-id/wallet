import type { Address } from "viem";

export type BudgetToken = {
    symbol: string;
    address: Address;
    balance: bigint;
    allowance: bigint;
};

export type TokenStatus = "empty" | "paused" | "warning" | "active";

export function getTokenStatus(
    balance: bigint,
    allowance: bigint
): TokenStatus {
    if (balance === 0n) return "empty";
    if (allowance === 0n) return "paused";
    if (allowance < balance) return "warning";
    return "active";
}

export const statusBadgeVariant = {
    active: "success",
    warning: "warning",
    paused: "error",
} as const;

export function splitTokensByFunding(tokens: BudgetToken[]) {
    return {
        funded: tokens.filter((t) => t.balance > 0n),
        empty: tokens.filter((t) => t.balance === 0n),
    };
}
