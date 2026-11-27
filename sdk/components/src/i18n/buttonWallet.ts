import type { Language } from "@frak-labs/core-sdk";

export type ButtonWalletCopy = {
    ariaLabel: string;
};

export const buttonWalletCopy: Record<Language, ButtonWalletCopy> = {
    en: {
        ariaLabel: "Share and earn rewards",
    },
    fr: {
        ariaLabel: "Partagez et gagnez des récompenses",
    },
};
