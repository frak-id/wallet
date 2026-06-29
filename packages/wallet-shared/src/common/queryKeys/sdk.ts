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
        all: [base, tokenBase] as const,
        bySession: (address?: Hex) =>
            [base, tokenBase, address ?? "no-session"] as const,
    };
}
