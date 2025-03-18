import type { Hex } from "viem";

/**
 * Query keys for wallet-related queries
 */
const base = {
    interactions: ["interactions"] as const,
    claimable: ["claimable"] as const,
    balance: ["balance"] as const,
} as const;

export const walletQueryKeys = {
    interactions: {
        base: base.interactions,
        closeSession: [...base.interactions, "close-session"] as const,
        openSession: [...base.interactions, "open-session"] as const,
        sessionStatus: {
            base: [...base.interactions, "session-status"] as const,
            byAddress: (address: Hex | undefined) =>
                [
                    ...base.interactions,
                    "session-status",
                    address ?? "no-address",
                ] as const,
        },
    },
    claimable: {
        base: base.claimable,
        pending: {
            base: [...base.claimable, "pending"] as const,
            byAddress: (address: Hex | undefined) =>
                [
                    ...base.claimable,
                    "pending",
                    address ?? "no-address",
                ] as const,
        },
    },
    balance: {
        base: base.balance,
    },
} as const;
