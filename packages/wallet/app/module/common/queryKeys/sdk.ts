import type { Hex } from "viem";

const base = {
    sdk: ["sdk"] as const,
} as const;

/**
 * Query keys for common SDK-related queries
 */
export const commonSdkQueryKeys = {
    token: {
        safe: {
            bySession: (
                address: Hex | undefined,
                lastActionWallet: Hex | undefined
            ) =>
                [
                    ...base.sdk,
                    "token",
                    "safe",
                    address ?? "no-session",
                    lastActionWallet ?? "no-last-action",
                ] as const,
        },
    },
} as const;
