import type { Hex } from "viem";

/**
 * Query keys for recovery-related queries
 */
export namespace recoveryKey {
    /**
     * The base key
     */
    const base = "recovery" as const;

    /**
     * Query keys for available chains
     */
    const availableChainsBase = "get-available-chains" as const;
    export const availableChains = {
        full: (params: {
            walletAddress: Hex;
            guardianAddress: Hex;
        }) =>
            [
                base,
                availableChainsBase,
                params.walletAddress,
                params.guardianAddress,
            ] as const,
    };

    /**
     * Mutation keys for recovery-related mutations
     */
    export const createRecoveryPasskey = [base, "create-passkey"] as const;
    export const performRecovery = [base, "perform-recovery"] as const;
    export const parseRecoveryFile = [base, "parse-file"] as const;
}
