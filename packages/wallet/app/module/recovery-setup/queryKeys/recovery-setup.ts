import type { Hex } from "viem";

/**
 * Query keys for recovery setup-related queries
 */
const base = {
    recovery: ["recovery"] as const,
};

export const recoverySetupQueryKeys = {
    base: base.recovery,
    status: (address: Hex | undefined) =>
        [...base.recovery, "status", address ?? "no-address"] as const,
} as const;
