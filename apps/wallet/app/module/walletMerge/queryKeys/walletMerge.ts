import type { Address } from "viem";

/**
 * Query keys for the wallet-merge module.
 */
export namespace walletMergeKey {
    const base = "walletMerge" as const;

    export const all = [base] as const;

    /**
     * Live on-chain summary of the loser wallet's transferable funds.
     * Shared between `useLoserAssetSummary` (preview surface) and
     * `useMigrateLoserAssets` (re-reads the same key via `fetchQuery`
     * right before building its UserOp).
     */
    export const loserAssetSummary = (loser?: Address) =>
        [base, "loserAssetSummary", loser ?? "none"] as const;
}
