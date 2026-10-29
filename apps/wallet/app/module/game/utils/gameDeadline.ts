import type { GameResult } from "@frak-labs/backend-elysia/domain/game/schemas";
import type { TFunction } from "i18next";
import type { countdownOf } from "@/module/game/utils/gameCountdown";

/** A drawn player's certify-by date, until it passes. */
export function openDeadline(result: GameResult, now: number) {
    if (result.outcome !== "pending_verification" || !result.verifyBy) {
        return null;
    }
    return new Date(result.verifyBy).getTime() > now ? result.verifyBy : null;
}

/** "Only 3 h 20 min left", or in minutes alone under the hour. */
export function timeLeftOf(t: TFunction, left: ReturnType<typeof countdownOf>) {
    const hours = left.days * 24 + left.hours;
    return hours >= 1
        ? t("game.result.hero.timeLeftHours", { hours, minutes: left.minutes })
        : t("game.result.hero.timeLeftMinutes", { minutes: left.minutes });
}
