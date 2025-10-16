import type { Hex } from "viem";

/**
 * Query keys for pending balance-related queries
 */
export namespace pendingBalanceKey {
    const base = "pending-balance" as const;

    /**
     * Query keys for pending balance
     */
    export const byAddress = (address?: Hex) =>
        [base, address ?? "no-address"] as const;
}
