import type { Language } from "@frak-labs/core-sdk";

export type AmbassadorCopy = {
    // Every brand mention is a `{BRAND}` token: a literal name ships the
    // demo fixture's name onto real storefronts, and no type check sees it.
    heroEyebrow: string;
    heroHeadline: string;
    /** `heroLede` never carries a `{REWARD}` token; `heroLedeReward` does. */
    heroLede: string;
    heroLedeReward: string;
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
     * the link text without flattening it to a string. */
    faq5AnswerBeforeLink: string;
    faq5AnswerLinkText: string;
    faq5AnswerAfterLink: string;
    attributionBeforeLink: string;
    attributionLinkText: string;
    /** "Your rewards" section; `{REWARD}`, `{DAYS}`, `{DATE}` and `{BRAND}` are filled at render. */
    myRewardsEyebrow: string;
    myRewardsCashbackLabel: string;
    myRewardsFriendsLabel: string;
    myRewardsCountdown: string;
    myRewardsCountdownOneDay: string;
    myRewardsCountdownToday: string;
    myRewardsUnlockNote: string;
    /** Used when every pending reward is still locked; carries `{DATE}`. */
    myRewardsUnlockNoteAll: string;
    myRewardsClaimCta: string;
    myRewardsShareCta: string;
    myRewardsLinkedHeading: string;
    myRewardsReceived: string;
    myRewardsOnItsWay: string;
    myRewardsOnItsWayUnlock: string;
    myRewardsWalletCta: string;
    myRewardsShareAgainCta: string;
    /** Desktop stub beside the claim block. */
    myRewardsQrHeading: string;
    myRewardsQrCaption: string;
    /** Store heading while a reward is waiting to be claimed. */
    storeHeadingClaim: string;
};

export const ambassadorCopy: Record<Language, AmbassadorCopy> = {
    en: {
        heroEyebrow: "Ambassador program",
        heroHeadline: "Become an ambassador for {BRAND}",
        heroLede:
            "Love our products? Tell the people around you! Earn a reward as soon as someone buys thanks to you.",
        heroLedeReward:
            "Love our products? Tell the people around you! Earn {REWARD} as soon as someone buys thanks to you.",
        heroCtaLabel: "Become an ambassador",
        heroFacesCaption:
            "No form, no waiting: anyone can become an ambassador right away.",
        heroImageAlt: "{BRAND} ambassadors",
        heroRewardCaption: "for you, on every sale",
        heroRewardRefereePill: "+ {REWARD} for your friend",
        heroRewardRefereePillNoReward: "+ a perk for your friend",
        rewardEyebrow: "Referral program",
        rewardHeadingReward: "{REWARD} for you on every sale",
        rewardHeadingNoReward: "A reward for you on every sale",
        rewardEstimateCaption:
            "Estimate: the amount depends on the campaign and your friend's order.",
        rewardLede:
            "No cap: the more you share, the more sales your link brings in, and the more you earn!",
        rewardCtaLabel: "Get my link",
        rewardFooterCaption: "Free · no commitment · paid to your bank account",
        rewardNoBankDetails: "no bank details needed to start",
        rewardFallbackLabel: "A reward",
        explainerTitle: "How it works",
        explainerLede: "Three steps, nothing more.",
        explainerStep1Title: "I share with the people close to me",
        explainerStep1Description:
            "On WhatsApp, in an Instagram story, on TikTok… my unique link, generated automatically.",
        explainerStep2Title: "I get paid",
        explainerStep2Description:
            "Credited automatically to my wallet for every sale made through my referral link.",
        explainerStep3Title: "I collect my money",
        explainerStep3Description:
            "With the Frak app, I transfer my earnings to my bank account.",
        winWinHeading: "Your friends win too",
        winWinLede:
            "Recommend {BRAND} to the people close to you: they discover great products, and thanks to your link they get cashback on their first order. They can thank you for it!",
        winWinCard1Title: "You",
        winWinCard1Description: "to your secure wallet, on every sale",
        winWinCard2Title: "Your friend",
        winWinCard2Description:
            "in cashback to their secure wallet, on their first order",
        referralHeading: "Your ambassador link",
        referralLede: "Finally, a referral program that really pays!",
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
        myRewardsEyebrow: "Your rewards",
        myRewardsCashbackLabel: "Cashback on your orders",
        myRewardsFriendsLabel: "From your friends' purchases",
        myRewardsCountdown: "{DAYS} days left to claim it, until {DATE}",
        myRewardsCountdownOneDay: "1 day left to claim it, until {DATE}",
        myRewardsCountdownToday: "Expires today, claim it now",
        myRewardsUnlockNote: "Part of it unlocks on {DATE}",
        myRewardsUnlockNoteAll: "Unlocks on {DATE}",
        myRewardsClaimCta: "Claim my {REWARD}",
        myRewardsShareCta: "Share to earn more",
        myRewardsLinkedHeading: "Your rewards at {BRAND}",
        myRewardsReceived: "{REWARD} received",
        myRewardsOnItsWay: "{REWARD} on its way",
        myRewardsOnItsWayUnlock: "{REWARD} on its way, unlocking on {DATE}",
        myRewardsWalletCta: "Open my Frak wallet",
        myRewardsShareAgainCta: "Share again",
        myRewardsQrHeading: "On your computer?",
        myRewardsQrCaption: "Scan with your phone to claim it in the Frak app.",
        storeHeadingClaim: "Claim your {REWARD} in the app",
    },
    fr: {
        heroEyebrow: "Programme ambassadeur",
        heroHeadline: "Devenez ambassadeur {BRAND}",
        heroLede:
            "Vous aimez nos produits\u00A0? Parlez-en autour de vous\u00A0! Gagnez une récompense dès qu’un achat est réalisé grâce à vous.",
        heroLedeReward:
            "Vous aimez nos produits\u00A0? Parlez-en autour de vous\u00A0! Gagnez {REWARD} dès qu’un achat est réalisé grâce à vous.",
        heroCtaLabel: "Devenir ambassadeur",
        heroFacesCaption:
            "Pas de formulaire, pas d’attente\u00A0: tout le monde peut devenir ambassadeur immédiatement.",
        heroImageAlt: "Ambassadrices et ambassadeurs {BRAND}",
        heroRewardCaption: "pour vous, à chaque vente",
        heroRewardRefereePill: "+ {REWARD} offerts à votre filleul",
        heroRewardRefereePillNoReward: "+ un avantage pour votre filleul",
        rewardEyebrow: "Programme de parrainage",
        rewardHeadingReward: "{REWARD} pour vous à chaque vente",
        rewardHeadingNoReward: "Une récompense pour vous à chaque vente",
        rewardEstimateCaption:
            "Estimation\u00A0: le montant dépend de la campagne et du panier de votre proche.",
        rewardLede:
            "Pas de plafond\u00A0: plus vous partagez, plus de ventes sont générées grâce à votre lien, plus vous gagnez\u00A0!",
        rewardCtaLabel: "Obtenir mon lien",
        rewardFooterCaption:
            "Gratuit · sans engagement · versé sur votre compte bancaire",
        rewardNoBankDetails: "sans donnée bancaire pour commencer",
        rewardFallbackLabel: "Une récompense",
        explainerTitle: "Comment ça marche",
        explainerLede: "Trois gestes, rien de plus.",
        explainerStep1Title: "Je partage à mes proches",
        explainerStep1Description:
            "Via WhatsApp, en story Instagram, sur TikTok… mon lien unique, généré automatiquement.",
        explainerStep2Title: "Je reçois de l’argent",
        explainerStep2Description:
            "Crédité automatiquement dans mon porte-monnaie à chaque vente générée grâce à mon lien de recommandation.",
        explainerStep3Title: "Je récupère mon argent",
        explainerStep3Description:
            "En téléchargeant l’app Frak, je transfère mes gains sur mon compte bancaire.",
        winWinHeading: "Vos proches y gagnent aussi",
        winWinLede:
            "En conseillant {BRAND} à vos proches, non seulement vous leur faites découvrir de super produits, mais en plus, grâce à votre lien, ils bénéficient d’un cashback sur leur première commande\u00A0: ils peuvent vous dire merci\u00A0!",
        winWinCard1Title: "Vous",
        winWinCard1Description:
            "sur votre porte-monnaie sécurisé, à chaque vente",
        winWinCard2Title: "Votre filleul",
        winWinCard2Description:
            "en cashback sur son porte-monnaie sécurisé, à sa première commande",
        referralHeading: "Votre lien d’ambassadeur",
        referralLede:
            "Enfin un vrai programme de parrainage rémunérateur\u00A0!",
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
        myRewardsEyebrow: "Vos récompenses",
        myRewardsCashbackLabel: "Cashback sur vos commandes",
        myRewardsFriendsLabel: "Issu des achats de vos amis",
        myRewardsCountdown:
            "{DAYS} jours restants pour la récupérer, jusqu’au {DATE}",
        myRewardsCountdownOneDay:
            "1 jour restant pour la récupérer, jusqu’au {DATE}",
        myRewardsCountdownToday: "Expire aujourd’hui, récupérez-la maintenant",
        myRewardsUnlockNote: "Une partie se débloque le {DATE}",
        myRewardsUnlockNoteAll: "Se débloque le {DATE}",
        myRewardsClaimCta: "Récupérer mes {REWARD}",
        myRewardsShareCta: "Partager pour gagner plus",
        myRewardsLinkedHeading: "Vos récompenses chez {BRAND}",
        myRewardsReceived: "{REWARD} reçus",
        myRewardsOnItsWay: "{REWARD} en route",
        myRewardsOnItsWayUnlock: "{REWARD} en route, déblocage le {DATE}",
        myRewardsWalletCta: "Ouvrir mon wallet Frak",
        myRewardsShareAgainCta: "Partager à nouveau",
        myRewardsQrHeading: "Sur ordinateur\u00A0?",
        myRewardsQrCaption:
            "Scannez avec votre téléphone pour la récupérer dans l’app Frak.",
        storeHeadingClaim: "Récupérez vos {REWARD} dans l’app",
    },
};
