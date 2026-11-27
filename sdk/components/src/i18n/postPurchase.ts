import type { Language } from "@frak-labs/core-sdk";

export type PostPurchaseCopy = {
    refereeText: string;
    refereeNoRewardText: string;
    referrerText: string;
    referrerNoRewardText: string;
    ctaText: string;
    ctaNoRewardText: string;
    /** Referee without a linked wallet; `claimCtaText` carries `{REWARD}`. */
    claimCtaText: string;
    claimCtaNoRewardText: string;
};

export const postPurchaseCopy: Record<Language, PostPurchaseCopy> = {
    en: {
        refereeText:
            "You just earned {REWARD}! Share with friends to earn even more.",
        refereeNoRewardText:
            "You just earned a reward! Share with friends to earn even more.",
        referrerText: "Earn {REWARD} by sharing this with your friends!",
        referrerNoRewardText: "Share this with your friends and earn rewards!",
        ctaText: "Share & earn {REWARD}",
        ctaNoRewardText: "Share & earn",
        claimCtaText: "Claim my {REWARD}",
        claimCtaNoRewardText: "Claim my cashback",
    },
    fr: {
        refereeText:
            "Vous venez de gagner {REWARD} ! Partagez avec vos amis pour gagner encore plus.",
        refereeNoRewardText:
            "Vous venez de gagner une récompense ! Partagez avec vos amis pour gagner encore plus.",
        referrerText: "Gagnez {REWARD} en partageant avec vos amis !",
        referrerNoRewardText:
            "Partagez avec vos amis et gagnez des récompenses !",
        ctaText: "Partagez et gagnez {REWARD}",
        ctaNoRewardText: "Partagez et gagnez",
        claimCtaText: "Récupérer mes {REWARD}",
        claimCtaNoRewardText: "Récupérer mon cashback",
    },
};
