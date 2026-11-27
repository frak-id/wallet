import type { Language } from "@frak-labs/core-sdk";

export type OpenInAppCopy = {
    text: string;
    ariaLabel: string;
};

export const openInAppCopy: Record<Language, OpenInAppCopy> = {
    en: {
        text: "Open in App",
        ariaLabel: "Open in Frak Wallet app",
    },
    fr: {
        text: "Ouvrir dans l'app",
        ariaLabel: "Ouvrir dans l'app Frak Wallet",
    },
};
