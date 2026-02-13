import type { Address } from "viem";

/**
 * Query keys for rewards-related queries
 */
export const rewardsKey = {
    all: ["rewards"] as const,
    histories: () => [...rewardsKey.all, "history"] as const,
    historyByAddress: (address?: Address) =>
        [...rewardsKey.histories(), address ?? "no-address"] as const,
};
