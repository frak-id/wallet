import type { Hex } from "viem";

/**
 * Query keys for tokens-related queries
 */
const base = {
    balance: ["balance"] as const,
    pendingBalance: ["pending-balance"] as const,
};

export const tokensQueryKeys = {
    balance: {
        base: base.balance,
        byAddress: (address?: Hex) =>
            [...base.balance, address ?? "no-address"] as const,
    },
    pendingBalance: {
        base: base.pendingBalance,
        byAddress: (address?: Hex) =>
            [...base.pendingBalance, address ?? "no-address"] as const,
    },
} as const;
