import { personas } from "@/data/personas";
import { campaign, clock } from "@/data/rewards";
import type { WalletPhase } from "@/surfaces/contracts";

export type RewardStatus = "settled" | "consumed";

export type RewardTag =
    | { kind: "referralOf"; name: string }
    | { kind: "welcomeBonus" };

export type PhaseReward = {
    amount: number;
    /** Time of day the reward was created, shown as "Today, 21:31". */
    time: string;
    tag: RewardTag;
};

/** A Monerium payout to the persona's bank, drawn above the reward it spent. */
export type PhaseTransfer = {
    amount: number;
    time: string;
};

const leaReward: PhaseReward = {
    amount: campaign.referrerReward,
    time: clock.chloe,
    tag: { kind: "referralOf", name: personas.chloe.firstName },
};

export const phaseRewards: Record<WalletPhase, PhaseReward> = {
    "referrer-earned": leaReward,
    "referrer-transferred": leaReward,
    "referee-earned": {
        amount: campaign.refereeReward,
        time: clock.chloe,
        tag: { kind: "welcomeBonus" },
    },
};

export const phaseTransfers: Partial<Record<WalletPhase, PhaseTransfer>> = {
    "referrer-transferred": {
        amount: campaign.referrerReward,
        time: clock.chloe,
    },
};
