import type { Hex } from "viem";

const base = {
    recoverySetup: ["recovery-setup"] as const,
};

/**
 * Query keys for recovery setup-related queries
 */
export const recoverySetupQueryKeys = {
    base: base.recoverySetup,
    status: (address: Hex | undefined) =>
        [...base.recoverySetup, "status", address ?? "no-address"] as const,
} as const;

/**
 * Mutation keys for recovery setup-related mutations
 */
export const recoverySetupMutationKeys = {
    base: base.recoverySetup,
    downloadRecoveryFile: [...base.recoverySetup, "download-file"] as const,
    generateFile: [...base.recoverySetup, "generate-file"] as const,
    setup: (address?: Hex) =>
        [...base.recoverySetup, "setup", address ?? "no-address"] as const,
} as const;
