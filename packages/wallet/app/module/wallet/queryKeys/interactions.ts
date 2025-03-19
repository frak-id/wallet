import type { Hex } from "viem";

const base = {
    interactions: ["interactions"] as const,
} as const;

/**
 * Query keys for wallet-related interactions queries
 */
export const walletInteractionsQueryKeys = {
    base: base.interactions,
    sessionStatus: {
        base: [...base.interactions, "session-status"] as const,
        byAddress: (address: Hex | undefined) =>
            [
                ...base.interactions,
                "session-status",
                address ?? "no-address",
            ] as const,
    },
} as const;

/**
 * Mutation keys for wallet-related interactions mutations
 */
export const walletInteractionsMutationKeys = {
    closeSession: [
        ...walletInteractionsQueryKeys.base,
        "close-session",
    ] as const,
    openSession: [...walletInteractionsQueryKeys.base, "open-session"] as const,
    consumePending: [
        ...walletInteractionsQueryKeys.base,
        "consume-pending",
    ] as const,
};
