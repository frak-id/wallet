import type { Address } from "viem";

/**
 * Query keys for pairing queries / mutations
 */
export namespace pairingKey {
    /**
     * The base key
     */
    const base = "pairing" as const;

    /**
     * Get info for a pairing
     */
    export const getInfo = (id?: string) => [base, id ?? ""] as const;

    /**
     * Delete a pairing
     */
    export const remove = [base, "delete"] as const;

    /**
     * List all the active pairings
     */
    export const list = {
        all: [base, "list"] as const,
        byWallet: (wallet?: Address) => [base, "list", wallet] as const,
    };
    export const listByWallet = list.byWallet;

    /**
     * Namespace for target pairing queries
     */
    export namespace target {
        const baseTarget = "target" as const;

        /**
         * Handle a signature request
         */
        export const handleSignatureRequest = (wallet?: Address) =>
            [base, baseTarget, "signature-request", wallet] as const;
    }
}
