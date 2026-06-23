import type { Address } from "viem";

export type NotificationEventItem = {
    wallets: Address[];
    merchantId: string;
    rewardCount: number;
};

export type NotificationEvent =
    | { type: "reward_pending"; notifications: NotificationEventItem[] }
    | { type: "reward_settled"; notifications: NotificationEventItem[] };
