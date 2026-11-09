import type { Language } from "@frak-labs/core-sdk";
import { componentDefaults } from "@/i18n/defaults";
import { fillReminderText } from "./format";

/** "Expires today", "1 day left" or "{DAYS} days left", in the component's language. */
export function getCountdownLabel(days: number, lang: Language): string {
    const copy = componentDefaults[lang].rewardReminder;
    if (days <= 0) return copy.countdownToday;
    if (days === 1) return copy.countdownOneDay;
    return fillReminderText(copy.countdownDays, { days });
}
