import type { Language } from "@frak-labs/core-sdk";

/** Read by `getCountdownLabel`, which both the banner and the reward reminder call. */
export type CountdownCopy = {
    countdownToday: string;
    countdownOneDay: string;
    /** Carries `{DAYS}`. */
    countdownDays: string;
};

export const countdownCopy: Record<Language, CountdownCopy> = {
    en: {
        countdownToday: "Expires today",
        countdownOneDay: "1 day left",
        countdownDays: "{DAYS} days left",
    },
    fr: {
        countdownToday: "Expire aujourd’hui",
        countdownOneDay: "1 jour restant",
        countdownDays: "{DAYS} jours restants",
    },
};
