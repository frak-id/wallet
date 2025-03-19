import type { Hex } from "viem";

/**
 * Query keys for recovery setup-related queries
 */
export namespace recoverySetupKey {
    /**
     * The base key
     */
    const base = "recovery-setup" as const;

    /**
     * Query keys for status
     */
    export const status = (address?: Hex) =>
        [base, "status", address ?? "no-address"] as const;

    /**
     * Mutation keys
     */
    export const downloadRecoveryFile = [base, "download-file"] as const;
    export const generateFile = [base, "generate-file"] as const;
    export const setup = (address?: Hex) =>
        [base, "setup", address ?? "no-address"] as const;
}
