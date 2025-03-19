import type { Hex } from "viem";

const base = {
    history: ["history"] as const,
} as const;

/**
 * Query keys for history-related queries
 */
export const historyQueryKeys = {
    interactions: {
        base: [...base.history, "interactions"] as const,
        byAddress: (address?: Hex) => [
            ...historyQueryKeys.interactions.base,
            address ?? "no-address",
        ],
    },
    rewards: {
        base: [...base.history, "rewards"] as const,
        byAddress: (address?: Hex) => [
            ...historyQueryKeys.rewards.base,
            address ?? "no-address",
        ],
    },
} as const;
