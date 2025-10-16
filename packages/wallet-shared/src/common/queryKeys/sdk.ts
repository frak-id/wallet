import type { Hex } from "viem";

/**
 * Query keys for common SDK-related queries
 */
export namespace sdkKey {
    /**
     * The base key
     */
    const base = "sdk" as const;

    /**
     * Query keys for token
     */
    const tokenBase = "token" as const;
    export const token = {
        bySession: (address?: Hex, lastActionWallet?: Hex) =>
            [
                base,
                tokenBase,
                address ?? "no-session",
                lastActionWallet ?? "no-last-action",
            ] as const,
    };
}
