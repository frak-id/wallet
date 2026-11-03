import { personas } from "@/data/personas";
import { campaign, clock } from "@/data/rewards";
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
    tag: RewardTag;
    status: Exclude<RewardStatus, "consumed">;
};

export const phaseRewards: Record<WalletPhase, PhaseReward> = {
    "referrer-pending": {
        amount: campaign.referrerReward,
        time: clock.lea,
        tag: { kind: "referral" },
        status: "waitingFriend",
    },
    "referrer-earned": {
        amount: campaign.referrerReward,
        time: clock.chloe,
        tag: { kind: "referralOf", name: personas.chloe.firstName },
        status: "settled",
    },
    "referee-earned": {
        amount: campaign.refereeReward,
        time: clock.chloe,
        tag: { kind: "welcomeBonus" },
        status: "settled",
    },
};
