import type { Hex } from "viem";

/**
 * Query keys for claimable-related queries
 */
const base = {
    claimable: ["claimable"] as const,
} as const;

export const claimableQueryKeys = {
    base: base.claimable,
    pending: {
        base: [...base.claimable, "pending"] as const,
        byAddress: (address?: Hex) =>
            [...base.claimable, "pending", address ?? "no-address"] as const,
    },
    claim: {
        base: [...base.claimable, "do-claim"] as const,
        byAddress: (address?: Hex) =>
            [...base.claimable, "do-claim", address ?? "no-address"] as const,
    },
} as const;
