import type { Language } from "@frak-labs/core-sdk";

/** Wording around a plan's reward figure; each carries `{REWARD}`. */
export type RewardWordingCopy = {
    upTo: string;
};

export const rewardWordingCopy: Record<Language, RewardWordingCopy> = {
    en: {
        upTo: "up to {REWARD}",
    },
    fr: {
        upTo: "jusqu'à {REWARD}",
    },
};
