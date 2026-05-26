import type { FlowEvents } from "./flow";

export type WalletMergeMode = "local" | "remote";
export type WalletMergeStep =
    | "preview"
    | "consent"
    | "switch"
    | "sign"
    | "migrate"
    | "settling";

type WalletMergeExtras = {
    mode: WalletMergeMode;
    requester_was_loser?: boolean;
    /** True when the migrate UserOp actually transferred assets. False
     *  when nothing was due to move (loser had no stablecoin balance and
     *  no claimable rewards). Lets us tell "merge with funds moved" from
     *  "merge of an empty wallet" in dashboards. */
    migrated?: boolean;
    /** Number of stablecoin entries transferred by the migrate UserOp.
     *  `0` when `migrated` is false or absent. */
    migrate_token_count?: number;
};

export type WalletMergeEventMap = FlowEvents<"wallet_merge", WalletMergeExtras>;
