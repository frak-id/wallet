import type { Hex } from "viem";

/**
 * Query keys for balance-related queries
 */
export namespace balanceKey {
    const base = "balance" as const;
    export const baseKey = [base] as const;

    /**
     * Query keys for balance
     */
    export const byAddress = (address?: Hex) =>
        [base, address ?? "no-address"] as const;
}
