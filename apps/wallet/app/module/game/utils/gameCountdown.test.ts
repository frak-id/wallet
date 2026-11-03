import { describe, expect, it } from "vitest";
import { countdownOf } from "./gameCountdown";

const now = new Date("2026-10-27T12:00:00Z").getTime();

describe("countdownOf", () => {
    it("splits days and the hours left in the day", () => {
        expect(countdownOf("2026-10-30T16:30:00Z", now)).toEqual({
            days: 3,
            hours: 4,
            minutes: 30,
            urgent: false,
            over: false,
        });
    });

    it("turns urgent under 24 hours", () => {
        expect(countdownOf("2026-10-27T17:12:00Z", now)).toEqual({
            days: 0,
            hours: 5,
            minutes: 12,
            urgent: true,
            over: false,
        });
    });

    it("is not urgent at exactly 24 hours", () => {
        expect(countdownOf("2026-10-28T12:00:00Z", now)).toMatchObject({
            days: 1,
            hours: 0,
            urgent: false,
            over: false,
        });
    });

    it("is over at zero once the game has ended", () => {
        expect(countdownOf("2026-10-27T11:00:00Z", now)).toEqual({
            days: 0,
            hours: 0,
            minutes: 0,
            urgent: true,
            over: true,
        });
    });

    it("rounds a partial minute up", () => {
        expect(countdownOf("2026-10-27T12:00:30Z", now)).toMatchObject({
            hours: 0,
            minutes: 1,
        });
        expect(countdownOf("2026-10-27T12:59:30Z", now)).toMatchObject({
            hours: 1,
            minutes: 0,
        });
    });

    it("stays calm in the last half-minute before the 24 hour mark, where it reads one day", () => {
        expect(countdownOf("2026-10-28T11:59:30Z", now)).toMatchObject({
            days: 1,
            hours: 0,
            urgent: false,
        });
    });

    it("keeps whole hours exact", () => {
        expect(countdownOf("2026-10-27T14:00:00Z", now)).toMatchObject({
            hours: 2,
            minutes: 0,
        });
    });
});
