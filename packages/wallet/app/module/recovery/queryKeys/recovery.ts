import type { Hex } from "viem";

/**
 * Query keys for recovery-related queries
 */
const base = {
    recovery: ["recovery"] as const,
};

export const recoveryQueryKeys = {
    base: base.recovery,
    availableChains: (params: {
        walletAddress: Hex;
        guardianAddress: Hex;
    }) =>
        [
            ...base.recovery,
            "get-available-chains",
            params.walletAddress,
            params.guardianAddress,
        ] as const,
} as const;
