import type { Language } from "@frak-labs/core-sdk";

/**
 * Shape of the built-in copy for every SDK Web Component. Declared explicitly
 * so each supported {@link Language} is forced to provide the exact same set
 * of keys (a missing translation is a type error, not a silent fallback).
 */
type ComponentCopy = {
    buttonShare: {
        text: string;
    };
    postPurchase: {
        refereeText: string;
        refereeNoRewardText: string;
        referrerText: string;
        referrerNoRewardText: string;
        ctaText: string;
        ctaNoRewardText: string;
    };
    openInApp: {
        text: string;
        ariaLabel: string;
    };
    buttonWallet: {
        ariaLabel: string;
    };
    banner: {
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
    };
};

/**
 * Built-in, per-language default copy for the SDK Web Components.
 *
 * These strings are the last-resort fallback, used only when a merchant
 * provides neither an HTML attribute override nor a backend-config override.
 * They keep the components bilingual out of the box **without** pulling an
 * i18n runtime (e.g. i18next) into the size-critical CDN bundle — resolution
 * is a plain object lookup keyed by the active language (see `useLang`).
 *
 * Adding a new language is a matter of adding one entry here plus extending
 * the `Language` union in `@frak-labs/core-sdk` — no new dependency, no
 * merchant action, no SDK API change.
 */
export const componentDefaults: Record<Language, ComponentCopy> = {
    en: {
        buttonShare: {
            text: "Share and earn!",
        },
        postPurchase: {
            refereeText:
                "You just earned {REWARD}! Share with friends to earn even more.",
            refereeNoRewardText:
                "You just earned a reward! Share with friends to earn even more.",
            referrerText: "Earn {REWARD} by sharing this with your friends!",
            referrerNoRewardText:
                "Share this with your friends and earn rewards!",
            ctaText: "Share & earn {REWARD}",
            ctaNoRewardText: "Share & earn",
        },
        openInApp: {
            text: "Open in App",
            ariaLabel: "Open in Frak Wallet app",
        },
        buttonWallet: {
            ariaLabel: "Open wallet",
        },
        banner: {
            referralTitleReward: "Earn {REWARD} on purchases on this site",
            referralTitle: "You've been referred!",
            referralDescription:
                "Earn rewards after your purchase via the Frak partner app.",
            referralCta: "Got it",
            inappTitle: "Open in your browser",
            inappDescription:
                "For a better experience and to earn your rewards, open this page in your default browser.",
            inappCta: "Open browser",
            dismissLabel: "Dismiss",
        },
    },
    fr: {
        buttonShare: {
            text: "Partagez et gagnez !",
        },
        postPurchase: {
            refereeText:
                "Vous venez de gagner {REWARD} ! Partagez avec vos amis pour gagner encore plus.",
            refereeNoRewardText:
                "Vous venez de gagner une récompense ! Partagez avec vos amis pour gagner encore plus.",
            referrerText: "Gagnez {REWARD} en partageant avec vos amis !",
            referrerNoRewardText:
                "Partagez avec vos amis et gagnez des récompenses !",
            ctaText: "Partagez et gagnez {REWARD}",
            ctaNoRewardText: "Partagez et gagnez",
        },
        openInApp: {
            text: "Ouvrir dans l'app",
            ariaLabel: "Ouvrir dans l'app Frak Wallet",
        },
        buttonWallet: {
            ariaLabel: "Ouvrir le portefeuille",
        },
        banner: {
            referralTitleReward: "Gagnez {REWARD} sur vos achats sur ce site",
            referralTitle: "Vous avez été parrainé !",
            referralDescription:
                "Gagnez des récompenses après votre achat via l'application partenaire Frak.",
            referralCta: "J'ai compris",
            inappTitle: "Ouvrez dans votre navigateur",
            inappDescription:
                "Pour une meilleure expérience et pour gagner vos récompenses, ouvrez cette page dans votre navigateur par défaut.",
            inappCta: "Ouvrir le navigateur",
            dismissLabel: "Fermer",
        },
    },
};
