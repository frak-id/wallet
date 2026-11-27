import type { Language } from "@frak-labs/core-sdk";

export type RewardReminderCopy = {
    /** Line above the amount; carries `{BRAND}` (and `{REWARD}`, which merchant copy may use). */
    title: string;
    /** One short line under the claim button. */
    description: string;
    /** Carries `{REWARD}`. */
    cta: string;
    later: string;
    closeLabel: string;
    dismissLabel: string;
    /** Carries `{REWARD}`. */
    pillLabel: string;
    deadlineToday: string;
    /** Carries `{DATE}`. */
    deadlineOneDay: string;
    /** Carries `{DATE}`. */
    deadlineDays: string;
    /** Under the number in the day tile. */
    tileDays: string;
    tileOneDay: string;
    /** Last-day tile: a short word, then its smaller second line. */
    tileLastDay: string;
    tileLastDayUnit: string;
    /** Carries `{DATE}`. */
    unlockNote: string;
    /** Used when every pending reward is still locked; carries `{DATE}`. */
    unlockNoteAll: string;
    /** Carries `{REWARD}`. */
    breakdownCashback: string;
    /** Carries `{REWARD}`. */
    breakdownFromFriends: string;
    qrLabel: string;
    /** Beside the small QR, which a click enlarges to a scannable size. */
    qrHint: string;
    qrCaption: string;
};

export const rewardReminderCopy: Record<Language, RewardReminderCopy> = {
    en: {
        title: "Waiting for you at {BRAND}",
        description: "Free with the Frak app, no bank details needed",
        cta: "Claim my {REWARD}",
        later: "Later",
        closeLabel: "Close",
        dismissLabel: "Dismiss reminder",
        pillLabel: "{REWARD} to claim, show details",
        deadlineToday: "Lost if not claimed today.",
        deadlineOneDay: "Lost if not claimed by {DATE}.",
        deadlineDays: "Lost if not claimed by {DATE}.",
        tileDays: "days left",
        tileOneDay: "day left",
        tileLastDay: "Last",
        tileLastDayUnit: "day",
        unlockNote: "Part of it unlocks on {DATE}.",
        unlockNoteAll: "Unlocks on {DATE}.",
        breakdownCashback: "{REWARD} cashback",
        breakdownFromFriends: "{REWARD} from friends",
        qrLabel: "QR code to claim your reward in the Frak wallet",
        qrHint: "On a computer? Click to enlarge, then scan with your phone.",
        qrCaption: "Scan with your phone to claim",
    },
    fr: {
        title: "Votre récompense chez {BRAND}",
        description: "Gratuit avec l’app Frak, sans coordonnées bancaires",
        cta: "Récupérer mes {REWARD}",
        later: "Plus tard",
        closeLabel: "Fermer",
        dismissLabel: "Masquer le rappel",
        pillLabel: "{REWARD} à récupérer, afficher le détail",
        deadlineToday: "Perdue si elle n’est pas récupérée aujourd’hui.",
        deadlineOneDay: "Perdue si elle n’est pas récupérée d’ici le {DATE}.",
        deadlineDays: "Perdue si elle n’est pas récupérée d’ici le {DATE}.",
        tileDays: "jours restants",
        tileOneDay: "jour restant",
        tileLastDay: "Dernier",
        tileLastDayUnit: "jour",
        unlockNote: "Une partie se débloque le {DATE}.",
        unlockNoteAll: "Se débloque le {DATE}.",
        breakdownCashback: "{REWARD} de cashback",
        breakdownFromFriends: "{REWARD} grâce à vos amis",
        qrLabel: "QR code pour récupérer votre récompense dans le wallet Frak",
        qrHint: "Sur ordinateur ? Agrandissez, puis scannez avec votre téléphone.",
        qrCaption: "Scannez avec votre téléphone pour la récupérer",
    },
};
