import type { Hex } from "viem";

const base = {
    claimable: ["claimable"] as const,
} as const;

/**
 * Query keys for wallet-related claimable queries
 */
export const claimableQueryKeys = {
    base: base.claimable,
    pending: {
        base: [...base.claimable, "pending"] as const,
        byAddress: (address?: Hex) =>
            [...base.claimable, "pending", address ?? "no-address"] as const,
    },
} as const;

/**
 * Mutation keys for wallet-related claimable mutations
 */
export const claimableMutationKeys = {
    claim: {
        byAddress: (address?: Hex) =>
            [...base.claimable, "do-claim", address ?? "no-address"] as const,
    },
} as const;
