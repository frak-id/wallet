import type { FlowEvents } from "./flow";

export type WalletMergeMode = "local" | "remote";
export type WalletMergeStep =
    | "preview"
    | "assets"
    | "consent"
    | "switch"
    | "sign"
    | "settling";

type WalletMergeExtras = {
    mode: WalletMergeMode;
    requester_was_loser?: boolean;
};

export type WalletMergeEventMap = FlowEvents<"wallet_merge", WalletMergeExtras>;
