import { defineMessages } from "@/i18n";

export const walletMessages = defineMessages({
    fr: {
        "common.close": "Fermer",
        "common.back": "Retour",
        "common.today": "Aujourd'hui",

        "install.title": "Ne perdez pas vos {amount} !",
        "install.description":
            "Téléchargez l'app et connectez-vous pour récupérer vos gains.",
        "install.reward.label": "Votre récompense {merchant}",
        "install.reward.status": "En attente",
        "install.reward.detail":
            "Débloquée dès qu'une amie commande grâce à votre story.",
        "install.steps.title": "Comment ça marche",
        "install.steps.one": "Téléchargez l'app Frak",
        "install.steps.two":
            "Activez votre espace sécurisé en 10 secondes avec Face ID",
        "install.steps.three":
            "Retrouvez vos {amount} dans votre porte-monnaie",
        "install.download": "Télécharger l'app",
        "install.storeHint": "Gratuit sur l'App Store",

        "appStore.subtitle": "Gagnez en recommandant",
        "appStore.get": "Obtenir",
        "appStore.open": "Ouvrir",
        "appStore.ratings": "1,2 k notes",
        "appStore.rating": "4,8",
        "appStore.age": "Âge",
        "appStore.ageValue": "4+",
        "appStore.ageUnit": "ans",
        "appStore.chart": "Classement",
        "appStore.chartValue": "n° 12",
        "appStore.chartCategory": "Finance",
        "appStore.language": "Langue",
        "appStore.languageValue": "FR",
        "appStore.languageMore": "+ 1 autre",
        "appStore.shot.one": "Recommandez vos marques préférées",
        "appStore.shot.two": "Suivez vos gains en temps réel",
        "appStore.shot.three": "Sécurisé par Face ID",
        "appStore.description":
            "Partagez vos coups de cœur, gagnez de l'argent à chaque achat généré grâce à vous et transférez vos gains sur votre compte bancaire.",

        "onboarding.start": "Commencer",
        "onboarding.continue": "Continuer",
        "onboarding.activate": "Activer mon espace sécurisé",
        "onboarding.alreadyHaveAccount": "Déjà un compte ?",
        "onboarding.one.title": "Gagnez de l'argent en recommandant",
        "onboarding.one.description":
            "Partagez vos coups de cœur et gagnez de l'argent à chaque achat généré grâce à vous.",
        "onboarding.two.title": "Vos gains en temps réel",
        "onboarding.two.description":
            "Suivez vos gains et transférez-les sur votre compte bancaire quand vous voulez.",
        "onboarding.three.title": "Activez votre espace sécurisé en 10 sec",
        "onboarding.three.description":
            "Sans formulaire, sans paperasse. Votre porte-monnaie est prêt à recevoir vos gains, instantanément.",

        "keypass.title": "Sécurisez votre compte",
        "keypass.description":
            "Une clé sécurisée est enregistrée dans votre gestionnaire de mots de passe pour vous connecter rapidement via la biométrie.",
        "keypass.continue": "Continuer",

        "passkey.title": "Enregistrer une clé d'accès pour « {name} » ?",
        "passkey.body":
            "Les clés d'accès sont enregistrées dans votre trousseau iCloud et disponibles pour vous connecter sur tous vos appareils.",
        "passkey.account": "Clé d'accès",
        "passkey.continue": "Continuer",
        "passkey.otherOptions": "Autres options",
        "passkey.faceId": "Face ID",
        "passkey.ready": "Votre porte-monnaie est prêt",
        "passkey.connected": "Connecté à {merchant}",

        "claim.title": "Votre récompense vous attend",
        "claim.description":
            "Créez votre porte-monnaie pour la récupérer : c'est gratuit et prêt en 10 secondes.",
        "claim.ticketDetail": "Grâce à la recommandation de {referrer}.",
        "claim.check.one": "Sans formulaire, sans mot de passe",
        "claim.check.two": "Vos gains en temps réel",
        "claim.check.three": "Transférables sur votre compte bancaire",
        "claim.cta": "Continuer avec Face ID",
        "claim.privacy":
            "Frak ne stocke aucune donnée personnelle ou biométrique.",

        "wallet.pageTitle": "Porte-monnaie",
        "wallet.tab.wallet": "Porte-monnaie",
        "wallet.tab.explorer": "Explorer",
        "wallet.tab.profile": "Profil",
        "balance.label": "Solde total",
        "balance.transfer": "Transférer vers ma banque",
        "balance.pending": "En attente",
        "balance.lifetime": "Depuis le début",
        "history.title": "Historique des gains",
        "history.referral": "Parrainage",
        "history.referralOf": "Parrainage · {name}",
        "history.welcomeBonus": "Cadeau de parrainage",
        "history.status.waitingFriend":
            "Débloqué dès qu'une amie commande via votre lien",
        "history.status.settled": "À collecter",
        "nudge.live.title": "Votre story est en ligne",
        "nudge.live.description":
            "Chaque amie qui commande via votre lien vous rapporte {amount}.",
        "nudge.live.cta": "Partager à nouveau",
        "nudge.turn.title": "À votre tour de recommander",
        "nudge.turn.description":
            "Partagez {merchant} et gagnez {amount} pour chaque amie qui commande.",
        "nudge.turn.cta": "Partager",
        "collect.title": "{name} a commandé grâce à vous",
        "pendingGains.subtitle": "Gains en attente",
        "pendingGains.heading": "Bonne nouvelle !\nDe l'argent vous attend.",
        "pendingGains.description":
            "Vos gains sont arrivés. Collectez-les maintenant dans votre porte-monnaie.",
        "pendingGains.confirm": "Collecter mes gains",
        "pendingGains.success": "Gains collectés !",
        "history.transfer": "Frak Labs → IBAN ••••",

        "bankFlow.info.title": "Finalisez votre compte pour toucher vos gains.",
        "bankFlow.info.description":
            "Pour transférer vos gains sur votre compte bancaire, vous devez finaliser votre compte de paiement sécurisé.",
        "bankFlow.info.redirectNotice":
            "Vous allez être redirigé vers notre partenaire financier, Monerium, pour :",
        "bankFlow.info.feature1Title": "Vérifier votre identité",
        "bankFlow.info.feature1Description":
            "Pour sécuriser votre compte et vérifier que vous êtes bien le titulaire des gains.",
        "bankFlow.info.feature2Title": "Ajouter votre IBAN",
        "bankFlow.info.feature2Description":
            "Pour recevoir vos gains directement sur votre compte bancaire.",
        "bankFlow.info.feature3Title": "Sécuriser vos transferts",
        "bankFlow.info.feature3Description":
            "Vos transactions sont protégées et conformes aux normes de sécurité en vigueur.",
        "bankFlow.info.cta": "Accepter et continuer",
        "bankFlow.info.secondaryCta": "J'ai déjà un compte Monerium",
        "bankFlow.handoff.title": "Vérification avec Monerium",
        "bankFlow.handoff.description":
            "Vos informations sont transmises à Monerium, sur son espace sécurisé.",
        "bankFlow.handoff.document": "Pièce d'identité",
        "bankFlow.handoff.selfie": "Selfie",
        "bankFlow.handoff.iban": "IBAN",
        "bankFlow.handoff.documentSent": "Envoyée",
        "bankFlow.handoff.selfieSent": "Envoyé",
        "bankFlow.handoff.back": "Retour sur Frak Wallet…",
        "bankFlow.verification.title": "Vérification en cours",
        "bankFlow.verification.description":
            "Monerium vérifie votre identité. Cela peut prendre de quelques minutes à quelques jours.",
        "bankFlow.verification.emailTitle": "Monerium vous prévient par e-mail",
        "bankFlow.verification.emailDescription":
            "Vous recevrez un e-mail dès que votre compte sera vérifié. Vous pouvez fermer cette page.",
        "bankFlow.verification.emailCta": "Compris",
        "bankFlow.verification.checkAgain": "Vérifier à nouveau",
        "bankFlow.success.title":
            "Vous pouvez maintenant transférer vos gains 🎉",
        "bankFlow.success.description":
            "Votre compte est prêt. Vous pouvez maintenant transférer vos gains sur votre compte bancaire en toute simplicité.",
        "bankFlow.success.cta": "Transférer mes gains",
        "bankFlow.amount.title": "Montant à transférer",
        "bankFlow.amount.walletLabel": "Porte-monnaie Frak",
        "bankFlow.amount.totalBalance": "Solde total : {amount}",
        "bankFlow.amount.ibanLabel": "IBAN",
        "bankFlow.amount.modify": "Modifier",
        "bankFlow.amount.continue": "Continuer",
        "bankFlow.recap.title": "Récapitulatif",
        "bankFlow.recap.cancel": "Annuler",
        "bankFlow.recap.amountLabel": "Montant",
        "bankFlow.recap.beneficiaryLabel": "Bénéficiaire",
        "bankFlow.recap.beneficiaryIban": "IBAN {iban}",
        "bankFlow.recap.addNote": "Ajouter une note",
        "bankFlow.recap.warning":
            "Une fois validée, l'opération ne peut être annulée",
        "bankFlow.recap.confirm": "Confirmer le transfert",
        "bankFlow.sent.title":
            "Votre demande de transfert de {amount} a été prise en compte",
        "bankFlow.sent.description":
            "Votre transfert est en route. Vous pouvez le suivre dans votre historique.",
        "bankPush.body": "Virement reçu de {sender} : +{amount}",
        "bankPush.time": "maintenant",
    },
    en: {
        "common.close": "Close",
        "common.back": "Back",
        "common.today": "Today",

        "install.title": "Don't lose your {amount}!",
        "install.description":
            "Download the app and log in to claim your rewards.",
        "install.reward.label": "Your {merchant} reward",
        "install.reward.status": "Pending",
        "install.reward.detail":
            "Unlocked as soon as a friend orders through your story.",
        "install.steps.title": "How it works",
        "install.steps.one": "Download the Frak app",
        "install.steps.two":
            "Activate your secure space in 10 seconds with Face ID",
        "install.steps.three": "Find your {amount} waiting in your wallet",
        "install.download": "Download the app",
        "install.storeHint": "Free on the App Store",

        "appStore.subtitle": "Earn by recommending",
        "appStore.get": "Get",
        "appStore.open": "Open",
        "appStore.ratings": "1.2K ratings",
        "appStore.rating": "4.8",
        "appStore.age": "Age",
        "appStore.ageValue": "4+",
        "appStore.ageUnit": "Years Old",
        "appStore.chart": "Chart",
        "appStore.chartValue": "No. 12",
        "appStore.chartCategory": "Finance",
        "appStore.language": "Language",
        "appStore.languageValue": "EN",
        "appStore.languageMore": "+ 1 More",
        "appStore.shot.one": "Recommend the brands you love",
        "appStore.shot.two": "Track your earnings in real time",
        "appStore.shot.three": "Secured with Face ID",
        "appStore.description":
            "Share your favorites, earn money for every purchase you help generate and transfer your earnings to your bank account.",

        "onboarding.start": "Get started",
        "onboarding.continue": "Continue",
        "onboarding.activate": "Activate my secure space",
        "onboarding.alreadyHaveAccount": "Already have an account?",
        "onboarding.one.title": "Earn money by recommending",
        "onboarding.one.description":
            "Share your favorites and earn money for every purchase you help generate.",
        "onboarding.two.title": "Your earnings in real time",
        "onboarding.two.description":
            "Track your earnings and transfer them to your bank account whenever you want.",
        "onboarding.three.title": "Activate your secure space in 10 sec",
        "onboarding.three.description":
            "No forms, no paperwork. Your wallet is ready to receive your earnings, instantly.",

        "keypass.title": "Secure your account",
        "keypass.description":
            "A secure key is saved in your password manager to quickly log in via biometrics.",
        "keypass.continue": "Continue",

        "passkey.title": "Save a passkey for “{name}”?",
        "passkey.body":
            "Passkeys are saved in your iCloud Keychain and available for sign-in on all your devices.",
        "passkey.account": "Passkey",
        "passkey.continue": "Continue",
        "passkey.otherOptions": "Other Options",
        "passkey.faceId": "Face ID",
        "passkey.ready": "Your wallet is ready",
        "passkey.connected": "Connected to {merchant}",

        "claim.title": "Your reward is waiting",
        "claim.description":
            "Create your wallet to claim it: it's free and ready in 10 seconds.",
        "claim.ticketDetail": "Thanks to {referrer}'s recommendation.",
        "claim.check.one": "No forms, no password",
        "claim.check.two": "Your earnings in real time",
        "claim.check.three": "Transferable to your bank account",
        "claim.cta": "Continue with Face ID",
        "claim.privacy": "Frak does not store any personal or biometric data.",

        "wallet.pageTitle": "Wallet",
        "wallet.tab.wallet": "Wallet",
        "wallet.tab.explorer": "Explorer",
        "wallet.tab.profile": "Profile",
        "balance.label": "Total balance",
        "balance.transfer": "Transfer to my bank",
        "balance.pending": "Pending",
        "balance.lifetime": "Lifetime",
        "history.title": "Earnings history",
        "history.referral": "Referral",
        "history.referralOf": "Referral · {name}",
        "history.welcomeBonus": "Referral gift",
        "history.status.waitingFriend":
            "Unlocks when a friend orders through your link",
        "history.status.settled": "To collect",
        "nudge.live.title": "Your story is live",
        "nudge.live.description":
            "Every friend who orders through your link earns you {amount}.",
        "nudge.live.cta": "Share again",
        "nudge.turn.title": "Your turn to recommend",
        "nudge.turn.description":
            "Share {merchant} and earn {amount} for every friend who orders.",
        "nudge.turn.cta": "Share",
        "collect.title": "{name} ordered thanks to you",
        "pendingGains.subtitle": "Pending earnings",
        "pendingGains.heading": "Great news!\nMoney is waiting for you.",
        "pendingGains.description":
            "Your earnings have arrived. Collect them now into your wallet.",
        "pendingGains.confirm": "Collect my earnings",
        "pendingGains.success": "Earnings collected!",
        "history.transfer": "Frak Labs → IBAN ••••",

        "bankFlow.info.title": "Complete your account to claim your earnings.",
        "bankFlow.info.description":
            "To transfer your earnings to your bank account, you need to complete your secure payment account setup.",
        "bankFlow.info.redirectNotice":
            "You will be redirected to our financial partner, Monerium, to:",
        "bankFlow.info.feature1Title": "Verify your identity",
        "bankFlow.info.feature1Description":
            "To secure your account and verify that you are the rightful owner of the earnings.",
        "bankFlow.info.feature2Title": "Add your IBAN",
        "bankFlow.info.feature2Description":
            "To receive your earnings directly into your bank account.",
        "bankFlow.info.feature3Title": "Secure your transfers",
        "bankFlow.info.feature3Description":
            "Your transactions are protected and comply with current security standards.",
        "bankFlow.info.cta": "Accept and continue",
        "bankFlow.info.secondaryCta": "I already have a Monerium account",
        "bankFlow.handoff.title": "Verifying with Monerium",
        "bankFlow.handoff.description":
            "Your details are sent to Monerium, on its secure space.",
        "bankFlow.handoff.document": "ID document",
        "bankFlow.handoff.selfie": "Selfie",
        "bankFlow.handoff.iban": "IBAN",
        "bankFlow.handoff.documentSent": "Sent",
        "bankFlow.handoff.selfieSent": "Sent",
        "bankFlow.handoff.back": "Back to Frak Wallet…",
        "bankFlow.verification.title": "Verification in progress",
        "bankFlow.verification.description":
            "Monerium is reviewing your identity. This can take from a few minutes to a couple of days.",
        "bankFlow.verification.emailTitle": "Monerium will email you",
        "bankFlow.verification.emailDescription":
            "You'll get an email as soon as your account is verified. You can close this page.",
        "bankFlow.verification.emailCta": "Got it",
        "bankFlow.verification.checkAgain": "Check again",
        "bankFlow.success.title": "You can now transfer your earnings 🎉",
        "bankFlow.success.description":
            "Your account is ready. You can now transfer your earnings to your bank account with ease.",
        "bankFlow.success.cta": "Transfer my earnings",
        "bankFlow.amount.title": "Amount to transfer",
        "bankFlow.amount.walletLabel": "Frak Wallet",
        "bankFlow.amount.totalBalance": "Total balance: {amount}",
        "bankFlow.amount.ibanLabel": "IBAN",
        "bankFlow.amount.modify": "Edit",
        "bankFlow.amount.continue": "Continue",
        "bankFlow.recap.title": "Summary",
        "bankFlow.recap.cancel": "Cancel",
        "bankFlow.recap.amountLabel": "Amount",
        "bankFlow.recap.beneficiaryLabel": "Beneficiary",
        "bankFlow.recap.beneficiaryIban": "IBAN {iban}",
        "bankFlow.recap.addNote": "Add a note",
        "bankFlow.recap.warning":
            "Once confirmed, this operation cannot be cancelled",
        "bankFlow.recap.confirm": "Confirm transfer",
        "bankFlow.sent.title":
            "Your transfer request of {amount} has been received",
        "bankFlow.sent.description":
            "Your transfer is on its way. You can follow it in your history.",
        "bankPush.body": "Transfer received from {sender}: +{amount}",
        "bankPush.time": "now",
    },
});
