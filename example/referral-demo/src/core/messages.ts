import { defineMessages } from "@/i18n";

/** Step titles (director list) and presenter notes (what to say on that screen). */
export const stepMessages = defineMessages({
    fr: {
        "home.title": "Accueil de la démo",
        "home.note":
            "Choisissez un scénario. Tout est simulé et fonctionne sans réseau.",
        "referrer.intro.title": "Léa, cliente fidèle",
        "referrer.intro.note":
            "Léa connaît Maison Lune et va passer commande. C'est elle qui va recommander la marque.",
        "referrer.storeHome.title": "Boutique Maison Lune",
        "referrer.storeHome.note":
            "Un site marchand classique. Frak s'intègre sans changer le parcours d'achat.",
        "referrer.product.title": "Fiche produit",
        "referrer.product.note":
            "Léa ajoute le Sérum Éclat à son panier, comme d'habitude.",
        "referrer.cart.title": "Panier",
        "referrer.cart.note":
            "Un panier à 71 € : la livraison est offerte, rien ne change pour le marchand.",
        "referrer.checkout.title": "Paiement",
        "referrer.checkout.note":
            "Paiement Apple Pay en un geste. Le tracking de l'achat est fait par le SDK Frak.",
        "referrer.thankYou.title": "Page de remerciement",
        "referrer.thankYou.note":
            "Moment clé : juste après l'achat, la carte Frak propose à Léa de gagner 10 € en recommandant la marque.",
        "referrer.sharing.title": "Page de partage Frak",
        "referrer.sharing.note":
            "La page de partage explique la récompense et génère un lien de parrainage unique pour Léa.",
        "referrer.shareSheet.title": "Feuille de partage iOS",
        "referrer.shareSheet.note":
            "Le partage natif du téléphone : Léa choisit sa story Instagram.",
        "referrer.storyComposer.title": "Story Instagram",
        "referrer.storyComposer.note":
            "La story embarque le visuel produit et un sticker lien vers Maison Lune, tracé par Frak.",
        "referrer.thankYouShared.title": "Retour sur la boutique",
        "referrer.thankYouShared.note":
            "De retour sur le site, la même carte a changé : la story est en ligne, Léa peut récupérer ses gains.",
        "referrer.install.title": "Télécharger Frak",
        "referrer.install.note":
            "Pour récupérer l'argent, Léa installe l'app Frak. Le lien conserve son identité et sa récompense.",
        "referrer.onboarding.title": "Onboarding du wallet",
        "referrer.onboarding.note":
            "Trois écrans pour comprendre : partager, gagner, encaisser. Ni mot de passe, ni seed phrase.",
        "referrer.passkey.title": "Création par passkey",
        "referrer.passkey.note":
            "Le compte est créé avec Face ID grâce aux passkeys. Dix secondes, zéro formulaire.",
        "referrer.wallet.title": "Gains débloqués",
        "referrer.wallet.note":
            "Deux heures plus tard, Chloé a commandé grâce à la story : les 10 € de Léa sont débloqués. Elle les collecte… puis veut les envoyer sur son compte.",
        "referrer.cashout.title": "Vers son compte bancaire",
        "referrer.cashout.note":
            "Premier virement : Monerium, partenaire financier régulé, vérifie l'identité de Léa. Validé en direct ici ; en vrai, de quelques minutes à quelques jours.",
        "referrer.transfer.title": "Virement",
        "referrer.transfer.note":
            "IBAN déjà enregistré pendant la vérification : montant, récap, Face ID. C'est parti.",
        "referrer.bank.title": "Sur son compte",
        "referrer.bank.note":
            "Les 10 € arrivent sur le compte de Léa, juste au-dessus de sa commande Maison Lune : la récompense, c'est de l'argent réel.",
        "referee.intro.title": "Chloé, amie de Léa",
        "referee.intro.note":
            "Retour sur l'achat qui a débloqué les 10 € de Léa : Chloé ne connaît pas Maison Lune, elle tombe sur sa story en scrollant Instagram.",
        "referee.feed.title": "Fil Instagram",
        "referee.feed.note":
            "La story de Léa apparaît en tête du fil de Chloé, comme n'importe quelle story.",
        "referee.story.title": "Story de Léa",
        "referee.story.note":
            "Une recommandation authentique, d'une amie. Chloé touche le sticker lien.",
        "referee.landing.title": "Arrivée parrainée",
        "referee.landing.note":
            "Le site reconnaît le lien de Léa : la bannière Frak annonce à Chloé 5 € sur son achat.",
        "referee.checkout.title": "Achat express",
        "referee.checkout.note":
            "Chloé commande le sérum en Apple Pay. Le parrainage est attribué automatiquement.",
        "referee.thankYou.title": "Récompense de Chloé",
        "referee.thankYou.note":
            "La carte Frak confirme les 5 € gagnés. Un tap pour les récupérer.",
        "referee.claim.title": "Création express",
        "referee.claim.note":
            "Le lien s'ouvre dans Safari, sans app à installer : Face ID, et le porte-monnaie web est prêt.",
        "referee.wallet.title": "Wallet de Chloé",
        "referee.wallet.note":
            "Les 5 € de Chloé sont dans son porte-monnaie web. Elle les collecte, et peut à son tour recommander Maison Lune.",
        "finale.title": "Tout le monde gagne",
        "finale.note":
            "Léa touche 10 €, Chloé 5 €, et Maison Lune gagne une nouvelle cliente, payée uniquement à la performance.",
    },
    en: {
        "home.title": "Demo home",
        "home.note":
            "Pick a scenario. Everything is simulated and runs offline.",
        "referrer.intro.title": "Léa, a loyal customer",
        "referrer.intro.note":
            "Léa knows Maison Lune and is about to order. She is the one who will recommend the brand.",
        "referrer.storeHome.title": "Maison Lune store",
        "referrer.storeHome.note":
            "A regular merchant website. Frak plugs in without changing the checkout flow.",
        "referrer.product.title": "Product page",
        "referrer.product.note":
            "Léa adds the Radiance Serum to her cart, as usual.",
        "referrer.cart.title": "Cart",
        "referrer.cart.note":
            "A €71 cart with free shipping: nothing changes for the merchant.",
        "referrer.checkout.title": "Checkout",
        "referrer.checkout.note":
            "One-touch Apple Pay. The Frak SDK tracks the purchase.",
        "referrer.thankYou.title": "Thank-you page",
        "referrer.thankYou.note":
            "Key moment: right after buying, the Frak card offers Léa €10 for recommending the brand.",
        "referrer.sharing.title": "Frak sharing page",
        "referrer.sharing.note":
            "The sharing page explains the reward and creates a unique referral link for Léa.",
        "referrer.shareSheet.title": "iOS share sheet",
        "referrer.shareSheet.note":
            "The phone's native sharing: Léa picks her Instagram story.",
        "referrer.storyComposer.title": "Instagram story",
        "referrer.storyComposer.note":
            "The story carries the product visual and a link sticker to Maison Lune, tracked by Frak.",
        "referrer.thankYouShared.title": "Back to the store",
        "referrer.thankYouShared.note":
            "Back on the website, the same card has changed: the story is live, Léa can collect her earnings.",
        "referrer.install.title": "Get Frak",
        "referrer.install.note":
            "To collect the money, Léa installs the Frak app. The link keeps her identity and her reward.",
        "referrer.onboarding.title": "Wallet onboarding",
        "referrer.onboarding.note":
            "Three screens to get it: share, earn, cash out. No password, no seed phrase.",
        "referrer.passkey.title": "Passkey sign-up",
        "referrer.passkey.note":
            "The account is created with Face ID thanks to passkeys. Ten seconds, zero forms.",
        "referrer.wallet.title": "Earnings unlocked",
        "referrer.wallet.note":
            "Two hours later, Chloé has ordered through the story: Léa's €10 is unlocked. She collects it… then wants it in her bank account.",
        "referrer.cashout.title": "To her bank account",
        "referrer.cashout.note":
            "First transfer: Monerium, a regulated financial partner, checks Léa's identity. Approved on the spot here; in real life, anywhere from minutes to a few days.",
        "referrer.transfer.title": "Transfer",
        "referrer.transfer.note":
            "IBAN already saved during the check: amount, summary, Face ID. Done.",
        "referrer.bank.title": "In her account",
        "referrer.bank.note":
            "The €10 lands in Léa's account, right above her Maison Lune order: the reward is real money.",
        "referee.intro.title": "Chloé, Léa's friend",
        "referee.intro.note":
            "Back to the purchase that unlocked Léa's €10: Chloé has never heard of Maison Lune and comes across the story while scrolling Instagram.",
        "referee.feed.title": "Instagram feed",
        "referee.feed.note":
            "Léa's story sits at the top of Chloé's feed, like any other story.",
        "referee.story.title": "Léa's story",
        "referee.story.note":
            "An authentic recommendation from a friend. Chloé taps the link sticker.",
        "referee.landing.title": "Referred landing",
        "referee.landing.note":
            "The store recognises Léa's link: the Frak banner tells Chloé she gets €5 on her purchase.",
        "referee.checkout.title": "Express purchase",
        "referee.checkout.note":
            "Chloé buys the serum with Apple Pay. The referral is attributed automatically.",
        "referee.thankYou.title": "Chloé's reward",
        "referee.thankYou.note":
            "The Frak card confirms the €5 she earned. One tap to collect it.",
        "referee.claim.title": "Express sign-up",
        "referee.claim.note":
            "The link opens in Safari, no app to install: Face ID, and the web wallet is ready.",
        "referee.wallet.title": "Chloé's wallet",
        "referee.wallet.note":
            "Chloé's €5 is in her web wallet. She collects it, and can now recommend Maison Lune in turn.",
        "finale.title": "Everybody wins",
        "finale.note":
            "Léa earns €10, Chloé €5, and Maison Lune wins a new customer, paid for on performance only.",
    },
});
