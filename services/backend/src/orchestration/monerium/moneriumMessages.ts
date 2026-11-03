import type { LocalisedNotificationPayload } from "@backend-domain/notifications";

function euros(amount: string, locale: "en" | "fr"): string {
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
    }).format(Number(amount));
}

/** Lock-screen copy: amounts are fine, IBANs, names and memos never appear. */
export const moneriumMessages = {
    orderProcessed: (
        amount: string,
        url: string
    ): LocalisedNotificationPayload => ({
        en: {
            title: "Transfer sent",
            body: `Your transfer of ${euros(amount, "en")} has been sent to your bank.`,
            data: { url },
        },
        fr: {
            title: "Virement envoyé",
            body: `Votre virement de ${euros(amount, "fr")} a été envoyé vers votre banque.`,
            data: { url },
        },
    }),
    orderRejected: (
        amount: string,
        url: string
    ): LocalisedNotificationPayload => ({
        en: {
            title: "Transfer rejected",
            body: `Your transfer of ${euros(amount, "en")} was rejected. Your funds stay in your wallet.`,
            data: { url },
        },
        fr: {
            title: "Virement refusé",
            body: `Votre virement de ${euros(amount, "fr")} a été refusé. Vos fonds restent dans votre portefeuille.`,
            data: { url },
        },
    }),
    profileApproved: (
        needsLinking: boolean,
        url: string
    ): LocalisedNotificationPayload => ({
        en: {
            title: "Bank account approved",
            body: needsLinking
                ? "Your Monerium account is approved. Link your wallet to start sending money to your bank."
                : "Your Monerium account is approved. You can now send money to your bank.",
            data: { url },
        },
        fr: {
            title: "Compte bancaire approuvé",
            body: needsLinking
                ? "Votre compte Monerium est approuvé. Liez votre portefeuille pour envoyer de l'argent vers votre banque."
                : "Votre compte Monerium est approuvé. Vous pouvez maintenant envoyer de l'argent vers votre banque.",
            data: { url },
        },
    }),
    profileBlocked: (url: string): LocalisedNotificationPayload => ({
        en: {
            title: "Bank account verification failed",
            body: "Monerium could not approve your account. Open your wallet for details.",
            data: { url },
        },
        fr: {
            title: "Vérification du compte bancaire refusée",
            body: "Monerium n'a pas pu approuver votre compte. Ouvrez votre portefeuille pour en savoir plus.",
            data: { url },
        },
    }),
};
