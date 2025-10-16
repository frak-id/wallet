import type { Hex } from "viem";

/**
 * Query keys for wallet-related interactions queries
 */
export namespace interactionsKey {
    /**
     * The base key
     */
    const base = "interactions" as const;

    /**
     * Query keys for session status
     */
    export const sessionStatus = {
        baseKey: [base, "session-status"] as const,
        byAddress: (address?: Hex) =>
            [base, "session-status", address ?? "no-address"] as const,
    };

    /**
     * Mutation keys
     */
    export const closeSession = [base, "close-session"] as const;
    export const openSession = [base, "open-session"] as const;
    export const consumePending = [base, "consume-pending"] as const;
}
