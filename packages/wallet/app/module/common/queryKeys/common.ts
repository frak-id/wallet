import type { Hex } from "viem";

/**
 * Query keys for common module queries
 */
const base = {
    sdk: ["sdk"] as const,
} as const;

export const commonQueryKeys = {
    sdk: {
        base: [...base.sdk] as const,
        token: {
            base: [...base.sdk, "token"] as const,
            safe: {
                base: [...base.sdk, "token", "safe"] as const,
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
    },
} as const;
