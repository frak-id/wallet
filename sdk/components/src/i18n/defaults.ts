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
    ambassador: {
        // Every brand mention is a `{BRAND}` token: a literal name ships the
        // demo fixture's name onto real storefronts, and no type check sees it.
        heroEyebrow: string;
        /** `heroHeadline` never carries a `{REWARD}` token; `heroHeadlineReward` does. */
        heroHeadline: string;
        heroHeadlineReward: string;
        heroLede: string;
        heroCtaLabel: string;
        heroFacesCaption: string;
        heroImageAlt: string;
        heroRewardCaption: string;
        /** Rendered only when a referee reward resolves, never otherwise; `*NoReward` names a percentage reward, which has no figure. */
        heroRewardRefereePill: string;
        heroRewardRefereePillNoReward: string;
        rewardEyebrow: string;
        rewardHeadingReward: string;
        rewardHeadingNoReward: string;
        rewardEstimateCaption: string;
        rewardLede: string;
        rewardCtaLabel: string;
        rewardFooterCaption: string;
        rewardNoBankDetails: string;
        /** The no-reward swap-in text for any amount display; keeps the sentence's subject. */
        rewardFallbackLabel: string;
        explainerTitle: string;
        explainerLede: string;
        explainerStep1Title: string;
        explainerStep1Description: string;
        explainerStep2Title: string;
        explainerStep2Description: string;
        /** Perk-free swap-in when the campaign has no referee reward. */
        explainerStep2DescriptionNoReward: string;
        explainerStep3Title: string;
        explainerStep3Description: string;
        winWinHeading: string;
        winWinLede: string;
        winWinCard1Title: string;
        winWinCard1Description: string;
        winWinCard2Title: string;
        winWinCard2Description: string;
        referralHeading: string;
        referralLede: string;
        referralCtaLabel: string;
        storeHeading: string;
        storeLede: string;
        storeAppBadgeAriaLabel: string;
        storePlayBadgeAriaLabel: string;
        storeQrLabel: string;
        storeQrCaption: string;
        faqHeading: string;
        faq1Question: string;
        faq1Answer: string;
        faq2Question: string;
        faq2Answer: string;
        faq3Question: string;
        faq3Answer: string;
        /** Perk-free swap-in when the campaign has no referee reward. */
        faq3AnswerNoReward: string;
        faq4Question: string;
        faq4Answer: string;
        faq5Question: string;
        /** The two frak.id anchors are markup inside plain copy: each is split into
         * before/link-text/after keys so the component can render a real `<a>` around
         * the link text without flattening it to a string (content-spec Rule 5). */
        faq5AnswerBeforeLink: string;
        faq5AnswerLinkText: string;
        faq5AnswerAfterLink: string;
        attributionBeforeLink: string;
        attributionLinkText: string;
    };
};

/**
 * Built-in, per-language default copy for the SDK Web Components.
 *
 * Last-resort fallback, used only when a merchant provides neither an HTML
 * attribute override nor a backend-config override. A plain object lookup
 * keyed by the active language keeps an i18n runtime out of the CDN bundle.
 */
export const componentDefaults: Record<Language, ComponentCopy> = {
    en: {
        buttonShare: {
            text: "Share & earn {REWARD}!",
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
            ariaLabel: "Share and earn rewards",
        },
        banner: {
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
        },
        ambassador: {
            heroEyebrow: "Ambassador program",
            heroHeadline: "Become an ambassador for {BRAND}.",
            heroHeadlineReward:
                "Become an ambassador for {BRAND} and earn {REWARD}.",
            heroLede:
                "You already talk about us to the people around you. We want to thank you for it: a reward on every order you inspire, plus a few perks reserved for our ambassadors.",
            heroCtaLabel: "Become an ambassador",
            heroFacesCaption: "Join the brand's ambassadors",
            heroImageAlt: "{BRAND} ambassadors",
            heroRewardCaption: "for you, per order",
            heroRewardRefereePill: "+ {REWARD} for your friend",
            heroRewardRefereePillNoReward: "+ a perk for your friend",
            rewardEyebrow: "Referral program",
            rewardHeadingReward:
                "{REWARD} for you, for every friend who orders.",
            rewardHeadingNoReward:
                "A reward for you, for every friend who orders.",
            rewardEstimateCaption:
                "Estimate: the amount depends on the campaign and your friend's order.",
            rewardLede:
                "No cap, no minimum amount. You share what you already love, and get paid when it works.",
            rewardCtaLabel: "Get my link",
            rewardFooterCaption:
                "Free · no commitment · paid to your bank account",
            rewardNoBankDetails: "no bank details needed to start",
            rewardFallbackLabel: "A reward",
            explainerTitle: "How it works",
            explainerLede: "Three steps, nothing more.",
            explainerStep1Title: "I share",
            explainerStep1Description:
                "You send your link to whoever you want: word of mouth, a story or a message.",
            explainerStep2Title: "They install",
            explainerStep2Description:
                "Your friend installs the Frak app in a few seconds, and also gets a perk on their order.",
            explainerStep2DescriptionNoReward:
                "Your friend installs the Frak app in seconds, then places their order.",
            explainerStep3Title: "I get my money",
            explainerStep3Description:
                "As soon as they order, your earnings land in your Frak wallet, ready to be transferred whenever you want.",
            winWinHeading: "Your friends earn too",
            winWinLede:
                "Recommending {BRAND} doesn't cost anyone anything. Your friend gets cashback on their first order: you never have to apologize for sending your link.",
            winWinCard1Title: "You",
            winWinCard1Description:
                "Credited to your wallet as soon as the order is confirmed.",
            winWinCard2Title: "Your friend",
            winWinCard2Description:
                "Cashback on their first order, at the same price as everyone else.",
            referralHeading: "Your referral link",
            referralLede:
                "Share it with anyone you like: you get paid on every order placed with it.",
            referralCtaLabel: "Share my link",
            storeHeading: "Track your earnings in real time",
            storeLede:
                "The Frak app notifies you as soon as a friend orders, and centralizes your earnings across every partner brand.",
            storeAppBadgeAriaLabel: "Download on the App Store",
            storePlayBadgeAriaLabel: "Get it on Google Play",
            storeQrLabel: "QR code to install the Frak app",
            storeQrCaption: "Scan to install",
            faqHeading: "Frequently asked questions",
            faq1Question: "Is it really free?",
            faq1Answer:
                "Yes, completely free. No subscription, no hidden fees. Your earnings land in your Frak wallet: real money, transferable to a bank account, with no fees.",
            faq2Question: "When do I get my money?",
            faq2Answer:
                "For every order generated by your link, your earnings are credited automatically to your Frak wallet. They become transferable once the brand confirms the purchase, with no minimum amount.",
            faq3Question: "Do my friends pay more with my link?",
            faq3Answer:
                "No, quite the opposite: you win and so do your friends. By ordering through your link, they also get cashback on their purchase.",
            faq3AnswerNoReward:
                "No. Your link doesn't change the price: your friends pay exactly what everyone else pays.",
            faq4Question: "Do I need to be an influencer?",
            faq4Answer:
                "No, not at all. No application, no minimum follower count: the program is open to all our customers, whatever the size of your network.",
            faq5Question: "What is Frak?",
            faq5AnswerBeforeLink:
                "The partner that handles referral tracking and payouts for {BRAND}. ",
            faq5AnswerLinkText: "Frak",
            faq5AnswerAfterLink: " never sells any data to third parties.",
            attributionBeforeLink: "Program powered by ",
            attributionLinkText: "Frak",
        },
    },
    fr: {
        buttonShare: {
            text: "Partagez et gagnez {REWARD} !",
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
            ariaLabel: "Partagez et gagnez des récompenses",
        },
        banner: {
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
        },
        ambassador: {
            heroEyebrow: "Programme ambassadeur",
            heroHeadline: "Devenez ambassadeur {BRAND}.",
            heroHeadlineReward:
                "Devenez ambassadeur {BRAND} et gagnez {REWARD}.",
            heroLede:
                "Vous parlez déjà de nous autour de vous. Nous vous en remercions\u00A0: une récompense sur chaque commande que vous inspirez, et quelques attentions réservées à nos ambassadeurs.",
            heroCtaLabel: "Devenir ambassadeur",
            heroFacesCaption:
                "Rejoignez les ambassadrices et ambassadeurs de la marque",
            heroImageAlt: "Ambassadrices et ambassadeurs {BRAND}",
            heroRewardCaption: "pour vous, par commande",
            heroRewardRefereePill: "+ {REWARD} offerts à votre filleul",
            heroRewardRefereePillNoReward: "+ un avantage pour votre filleul",
            rewardEyebrow: "Programme de parrainage",
            rewardHeadingReward:
                "{REWARD} pour vous, à chaque ami qui commande.",
            rewardHeadingNoReward:
                "Une récompense pour vous, à chaque ami qui commande.",
            rewardEstimateCaption:
                "Estimation\u00A0: le montant dépend de la campagne et du panier de votre proche.",
            rewardLede:
                "Pas de plafond, pas de montant minimum. Vous partagez ce que vous aimez déjà, vous êtes payé quand ça marche.",
            rewardCtaLabel: "Obtenir mon lien",
            rewardFooterCaption:
                "Gratuit · sans engagement · versé sur votre compte bancaire",
            rewardNoBankDetails: "sans donnée bancaire pour commencer",
            rewardFallbackLabel: "Une récompense",
            explainerTitle: "Comment ça marche",
            explainerLede: "Trois gestes, rien de plus.",
            explainerStep1Title: "Je partage",
            explainerStep1Description:
                "Vous transmettez votre lien à qui vous voulez\u00A0: de bouche à oreille, en story ou par message.",
            explainerStep2Title: "Mon ami installe",
            explainerStep2Description:
                "Votre ami installe l’app Frak en quelques secondes, et bénéficie lui aussi d’un avantage sur sa commande.",
            explainerStep2DescriptionNoReward:
                "Votre ami installe l’app Frak en quelques secondes, puis passe commande.",
            explainerStep3Title: "Je récupère mon argent",
            explainerStep3Description:
                "Dès qu’il commande, vos gains arrivent dans votre porte-monnaie Frak, prêts à être transférés quand vous le souhaitez.",
            winWinHeading: "Vos proches y gagnent aussi",
            winWinLede:
                "Recommander {BRAND} ne coûte rien à personne. Votre filleul reçoit un cashback sur sa première commande\u00A0: vous n’avez pas à vous excuser d’envoyer votre lien.",
            winWinCard1Title: "Vous",
            winWinCard1Description:
                "Crédités sur votre porte-monnaie dès que la commande est validée.",
            winWinCard2Title: "Votre filleul",
            winWinCard2Description:
                "Un cashback sur sa première commande, au même prix que tout le monde.",
            referralHeading: "Votre lien de parrainage",
            referralLede:
                "Partagez-le à qui vous voulez\u00A0: vous êtes payé à chaque commande passée avec.",
            referralCtaLabel: "Partager mon lien",
            storeHeading: "Suivez vos gains en temps réel",
            storeLede:
                "L’app Frak vous prévient dès qu’un ami commande, et centralise vos gains sur toutes les marques partenaires.",
            storeAppBadgeAriaLabel: "Télécharger dans l’App Store",
            storePlayBadgeAriaLabel: "Disponible sur Google Play",
            storeQrLabel: "QR code pour installer l’app Frak",
            storeQrCaption: "Scannez pour installer",
            faqHeading: "Questions fréquentes",
            faq1Question: "C’est vraiment gratuit\u00A0?",
            faq1Answer:
                "Oui, totalement gratuit. Pas d’abonnement, pas de frais cachés. Vos gains arrivent dans votre porte-monnaie Frak\u00A0: de l’argent réel, transférable vers un compte bancaire, sans commission.",
            faq2Question: "Quand est-ce que je reçois mon argent\u00A0?",
            faq2Answer:
                "À chaque commande générée par votre lien, vos gains sont crédités automatiquement dans votre porte-monnaie Frak. Ils deviennent transférables une fois l’achat confirmé par la marque, sans montant minimum.",
            faq3Question: "Mes amis paient-ils plus cher avec mon lien\u00A0?",
            faq3Answer:
                "Non, au contraire\u00A0: vous êtes gagnant et vos proches aussi. En commandant via votre lien, ils reçoivent eux aussi un cashback sur leur achat.",
            faq3AnswerNoReward:
                "Non. Votre lien ne change rien au prix\u00A0: vos proches paient exactement le même montant que tout le monde.",
            faq4Question: "Il faut être influenceur\u00A0?",
            faq4Answer:
                "Non, pas du tout. Aucune candidature, aucun minimum de followers\u00A0: le programme est ouvert à tous nos clients, quelle que soit la taille de votre réseau.",
            faq5Question: "C’est quoi Frak\u00A0?",
            faq5AnswerBeforeLink:
                "Le partenaire qui gère le suivi des parrainages et le versement des gains pour {BRAND}. ",
            faq5AnswerLinkText: "Frak",
            faq5AnswerAfterLink: " ne vend aucune donnée à des tiers.",
            attributionBeforeLink: "Programme propulsé par ",
            attributionLinkText: "Frak",
        },
    },
};
