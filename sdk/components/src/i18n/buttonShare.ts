import type { Language } from "@frak-labs/core-sdk";

export type ButtonShareCopy = {
    text: string;
};

export const buttonShareCopy: Record<Language, ButtonShareCopy> = {
    en: {
        text: "Share & earn {REWARD}!",
    },
    fr: {
        text: "Partagez et gagnez {REWARD} !",
    },
};
