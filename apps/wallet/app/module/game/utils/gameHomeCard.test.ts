import type { GameOutcome } from "@frak-labs/backend-elysia/domain/game/schemas";
import { describe, expect, it } from "vitest";
import { gameResult, gameSummary } from "@/tests/gameFixtures";
import { homeCardOf } from "./gameHomeCard";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-27T12:00:00Z").getTime();
const me = { participating: false } as never;
const open = { game: gameSummary(), me };
const none = { game: null, me };
const endedDaysAgo = (days: number, outcome: GameOutcome = "won") =>
    gameResult({
        game: { endsAt: new Date(now - days * DAY) },
        outcome,
    });

describe("homeCardOf", () => {
    it("is empty while the current game is still loading", () => {
        expect(homeCardOf(undefined, [endedDaysAgo(1)], now)).toBeNull();
    });

    it("is empty with no open game and no result", () => {
        expect(homeCardOf(none, [], now)).toBeNull();
        expect(homeCardOf(none, undefined, now)).toBeNull();
    });

    it("shows the open game", () => {
        expect(homeCardOf(open, [], now)).toEqual({
            kind: "open",
            game: open.game,
            me,
        });
    });

    it("prefers the open game over a result that ended", () => {
        expect(homeCardOf(open, [endedDaysAgo(2)], now)?.kind).toBe("open");
    });

    it("shows the latest result when it ended within two weeks", () => {
        const latest = endedDaysAgo(13);
        expect(homeCardOf(none, [latest, endedDaysAgo(40)], now)).toEqual({
            kind: "ended",
            result: latest,
        });
    });

    it("drops a result that ended two weeks ago", () => {
        expect(homeCardOf(none, [endedDaysAgo(14)], now)).toBeNull();
    });

    it("puts a draw waiting on the user first, even over an open game", () => {
        const pending = endedDaysAgo(1, "pending_verification");
        expect(homeCardOf(open, [pending], now)).toEqual({
            kind: "drawn",
            result: pending,
        });
        expect(homeCardOf(none, [endedDaysAgo(1), pending], now)).toEqual({
            kind: "drawn",
            result: pending,
        });
    });
});
