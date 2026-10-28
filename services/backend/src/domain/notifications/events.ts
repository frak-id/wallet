import type { Address } from "viem";

export type NotificationEventItem = {
    wallets: Address[];
    merchantId: string;
    rewardCount: number;
};

export type NotificationEvent =
    | { type: "reward_pending"; notifications: NotificationEventItem[] }
    | { type: "reward_settled"; notifications: NotificationEventItem[] }
    | { type: "game_won"; wallet: Address; prizeAmount: number }
    | ({ type: "game_candidate_drawn" } & GameCandidateNotice)
    | ({ type: "game_candidate_reminder" } & GameCandidateNotice);

type GameCandidateNotice = {
    wallet: Address;
    prizeAmount: number;
    verifyBy: Date;
};
