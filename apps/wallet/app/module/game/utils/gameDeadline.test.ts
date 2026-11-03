import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { gameResult } from "@/tests/gameFixtures";
import { countdownOf } from "./gameCountdown";
import { openDeadline, timeLeftOf } from "./gameDeadline";

const now = new Date("2026-10-27T12:00:00Z").getTime();
const verifyBy = new Date(now + 3_600_000);
const t = ((key: string, values: object) =>
    `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

describe("openDeadline", () => {
    it("is the certify-by date of a drawn player until it passes", () => {
        const drawn = gameResult({ outcome: "pending_verification", verifyBy });
        expect(openDeadline(drawn, now)).toBe(verifyBy);
        expect(openDeadline(drawn, verifyBy.getTime())).toBeNull();
    });

    it("is empty without a date or outside the drawn state", () => {
        expect(
            openDeadline(gameResult({ outcome: "pending_verification" }), now)
        ).toBeNull();
        expect(
            openDeadline(gameResult({ outcome: "won", verifyBy }), now)
        ).toBeNull();
    });
});

describe("timeLeftOf", () => {
    it("counts hours across days, and minutes alone under the hour", () => {
        expect(
            timeLeftOf(
                t,
                countdownOf(new Date(now + 26 * 3_600_000 + 60_000), now)
            )
        ).toBe('game.result.hero.timeLeftHours {"hours":26,"minutes":1}');
        expect(
            timeLeftOf(t, countdownOf(new Date(now + 20 * 60_000), now))
        ).toBe('game.result.hero.timeLeftMinutes {"minutes":20}');
    });
});
