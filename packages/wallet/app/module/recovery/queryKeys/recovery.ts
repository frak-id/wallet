import type { Hex } from "viem";

const base = {
    recovery: ["recovery"] as const,
};

/**
 * Query keys for recovery-related queries
 */
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

/**
 * Mutation keys for recovery-related mutations
 */
export const recoveryMutationKeys = {
    createRecoveryPasskey: [...base.recovery, "create-passkey"] as const,
    performRecovery: [...base.recovery, "perform-recovery"] as const,
    parseRecoveryFile: [...base.recovery, "parse-file"] as const,
} as const;
