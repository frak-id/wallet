import { personas } from "@/data/personas";
import { campaign, clock, daysUntilTransfer } from "@/data/rewards";
import type { WalletPhase } from "@/surfaces/contracts";

export type RewardStatus = "waitingFriend" | "settled" | "consumed";

export type RewardTag =
    | { kind: "referral" }
    | { kind: "referralOf"; name: string }
    | { kind: "welcomeBonus" };

export type PhaseReward = {
    amount: number;
    /** Time of day the reward was created, shown as "Today, 19:24". */
    time: string;
    /** Days between the reward and the moment the phase shows it. */
    daysAgo: number;
    tag: RewardTag;
    status: Exclude<RewardStatus, "consumed">;
};

/** A Monerium payout to the persona's bank, drawn above the reward it spent. */
export type PhaseTransfer = {
    amount: number;
    time: string;
    daysAgo: number;
};

export const phaseRewards: Record<WalletPhase, PhaseReward> = {
    "referrer-pending": {
        amount: campaign.referrerReward,
        time: clock.lea,
        daysAgo: 0,
        tag: { kind: "referral" },
        status: "waitingFriend",
    },
    "referrer-earned": {
        amount: campaign.referrerReward,
        time: clock.chloe,
        daysAgo: daysUntilTransfer,
        tag: { kind: "referralOf", name: personas.chloe.firstName },
        status: "settled",
    },
    "referee-earned": {
        amount: campaign.refereeReward,
        time: clock.chloe,
        daysAgo: 0,
        tag: { kind: "welcomeBonus" },
        status: "settled",
    },
    "referee-transferred": {
        amount: campaign.refereeReward,
        time: clock.chloe,
        daysAgo: daysUntilTransfer,
        tag: { kind: "welcomeBonus" },
        status: "settled",
    },
};

export const phaseTransfers: Partial<Record<WalletPhase, PhaseTransfer>> = {
    "referee-transferred": {
        amount: campaign.refereeReward,
        time: clock.transfer,
        daysAgo: 0,
    },
};
