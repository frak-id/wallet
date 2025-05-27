import type { Hex } from "viem";

/**
 * Query keys for history-related queries
 */
export namespace historyKey {
    /**
     * The base key
     */
    const base = "history" as const;

    /**
     * Query keys for interactions
     */
    const interactionsBase = "interactions" as const;
    export const interactions = {
        byAddress: (address?: Hex) =>
            [base, interactionsBase, address ?? "no-address"] as const,
    };

    /**
     * Query keys for rewards
     */
    const rewardsBase = "rewards" as const;
    export const rewards = {
        byAddress: (address?: Hex) =>
            [base, rewardsBase, address ?? "no-address"] as const,
    };
}
