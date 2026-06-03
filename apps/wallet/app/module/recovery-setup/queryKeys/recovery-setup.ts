import type { Hex } from "viem";

/**
 * Query keys for recovery setup-related queries
 */
export namespace recoverySetupKey {
    /**
     * The base key
     */
    const base = "recovery-setup" as const;

    export const all = [base] as const;

    /**
     * Query keys for status
     */
    export const status = (address?: Hex) =>
        [base, "status", address ?? "no-address"] as const;

    /**
     * Backend recovery-blob status (does a stored blob exist for this group).
     */
    export const backendStatus = [base, "backend-status"] as const;

    /**
     * Mutation keys
     */
    export const generateOptions = [base, "generate-options"] as const;
    export const saveBlob = [base, "save-blob"] as const;
    export const testPassword = [base, "test-password"] as const;
    export const setup = (address?: Hex) =>
        [base, "setup", address ?? "no-address"] as const;
}
