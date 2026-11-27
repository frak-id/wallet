import type { Language } from "@frak-labs/core-sdk";

export type BannerCopy = {
    /** Referral title used when an estimated reward is available (carries the `{REWARD}` token). */
    referralTitleReward: string;
    /** Referral title used when no reward could be resolved. */
    referralTitle: string;
    referralDescription: string;
    referralCta: string;
    inappTitle: string;
    inappDescription: string;
    inappCta: string;
    dismissLabel: string;
    /** Pending mode: a visitor with an unclaimed reward. Title and CTA carry `{REWARD}`. */
    pendingTitle: string;
    pendingDescription: string;
    /** Used when every pending reward is still locked; carries `{DATE}`. */
    pendingDescriptionLocked: string;
    pendingCta: string;
};

export const bannerCopy: Record<Language, BannerCopy> = {
    en: {
        referralTitleReward: "Earn {REWARD} on purchases",
        referralTitle: "You've been referred!",
        referralDescription:
            "Earn rewards after your purchase via the Frak partner app.",
        referralCta: "Got it",
        inappTitle: "Open in your browser",
        inappDescription:
            "For a better experience and to earn your rewards, open this page in your default browser.",
        inappCta: "Open browser",
        dismissLabel: "Dismiss",
        pendingTitle: "You have {REWARD} waiting",
        pendingDescription: "Create your free Frak wallet to receive it.",
        pendingDescriptionLocked:
            "Create your free Frak wallet to receive it. It unlocks on {DATE}.",
        pendingCta: "Claim my {REWARD}",
    },
    fr: {
        referralTitleReward: "Gagnez {REWARD} sur vos achats",
        referralTitle: "Vous avez été parrainé !",
        referralDescription:
            "Gagnez des récompenses après votre achat via l'application partenaire Frak.",
        referralCta: "J'ai compris",
        inappTitle: "Ouvrez dans votre navigateur",
        inappDescription:
            "Pour une meilleure expérience et pour gagner vos récompenses, ouvrez cette page dans votre navigateur par défaut.",
        inappCta: "Ouvrir le navigateur",
        dismissLabel: "Fermer",
        pendingTitle: "Votre récompense de {REWARD} vous attend",
        pendingDescription: "Créez votre wallet Frak gratuit pour la recevoir.",
        pendingDescriptionLocked:
            "Créez votre wallet Frak gratuit pour la recevoir. Déblocage le {DATE}.",
        pendingCta: "Récupérer mes {REWARD}",
    },
};
