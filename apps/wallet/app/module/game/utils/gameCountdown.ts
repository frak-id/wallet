import type { TFunction } from "i18next";

/** Time left until `endsAt`, rounded up to the minute; `urgent` while it reads under 24 h, `over` once it is reached. `hours` is the remainder of whole days. */
export function countdownOf(endsAt: Date | string, now: number) {
    const ms = Math.max(0, new Date(endsAt).getTime() - now);
    const totalMinutes = Math.ceil(ms / 60_000);
    return {
        days: Math.floor(totalMinutes / 1440),
        hours: Math.floor(totalMinutes / 60) % 24,
        minutes: totalMinutes % 60,
        urgent: totalMinutes < 1440,
        over: ms === 0,
    };
}

/** "Ends in 3 d 5 h", or in hours and minutes under a day. */
export function endsInOf(
    t: TFunction,
    countdown: ReturnType<typeof countdownOf>
) {
    return countdown.days >= 1
        ? t("game.page.hero.countdownDays", countdown)
        : t("game.page.hero.countdownHours", countdown);
}
