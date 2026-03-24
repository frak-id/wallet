import type { Address } from "viem";
import type { InteractionType } from "../domain/rewards";

export type NotificationEventItem = {
    wallets: Address[];
    merchantId: string;
    rewardCount: number;
};

export type NotificationEvent =
    | { type: "reward_pending"; notifications: NotificationEventItem[] }
    | { type: "reward_settled"; notifications: NotificationEventItem[] };

export type FrakEvents = {
    newInteraction: [{ type: InteractionType }];
    newPendingRewards: [{ count: number }];
    notification: [NotificationEvent];
};
