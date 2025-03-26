import type { Hex } from "viem";

/**
 * Query keys for wallet-related claimable queries
 */
export namespace claimableKey {
    /**
     * The base key
     */
    const base = "claimable" as const;

    /**
     * Query keys for pending claimable
     */
    export const pending = {
        byAddress: (address?: Hex) =>
            [base, "pending", address ?? "no-address"] as const,
    };

    /**
     * Mutation keys for claimable
     */
    export const claim = {
        byAddress: (address?: Hex) =>
            [base, "do-claim", address ?? "no-address"] as const,
    };
}
