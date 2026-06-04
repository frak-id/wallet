import type { Address } from "viem";

/**
 * Query keys for recovery-related queries
 */
export namespace recoveryKey {
    /**
     * The base key
     */
    const base = "recovery" as const;

    /**
     * Query key for the on-chain recovery option of a wallet being recovered.
     */
    export const currentOption = {
        full: (params: { walletAddress: Address }) =>
            [base, "current-option", params.walletAddress] as const,
    };

    /**
     * Mutation keys for recovery-related mutations
     */
    export const createRecoveryPasskey = [base, "create-passkey"] as const;
    export const performRecovery = [base, "perform-recovery"] as const;
    export const claimRecovery = [base, "claim-recovery"] as const;
    export const runRecovery = [base, "run-recovery"] as const;
}
