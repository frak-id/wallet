import type { Address } from "viem";

/**
 * Query keys for rewards-related queries
 */
export const rewardsKey = {
    all: ["rewards"] as const,
    histories: () => [...rewardsKey.all, "history"] as const,
    // "pages" keeps a persisted single-page cache from hydrating into the paged query.
    historyByAddress: (address?: Address) =>
        [...rewardsKey.histories(), "pages", address ?? "no-address"] as const,
    unpaidByAddress: (address?: Address) =>
        [...rewardsKey.all, "unpaid", address ?? "no-address"] as const,
};
