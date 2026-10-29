import { describe, expect, it } from "vitest";
import { gameResult } from "@/tests/gameFixtures";
import { recordOf } from "./gameRecord";

const played = (
    id: string,
    purchase: number,
    endsAt = "2026-10-01T18:00:00Z"
) =>
    gameResult({
        game: { id, endsAt: new Date(endsAt) },
        ticketsBySource: {
            join: 1,
            instagramCertified: 0,
            purchase,
            referredPurchase: 0,
            referredSignup: 0,
            brandShare: 0,
        },
    });

describe("recordOf", () => {
    it("calls the only game the first, its tickets the record to beat", () => {
        const latest = played("latest", 14);

        expect(recordOf(latest, [latest])).toEqual({ kind: "first", mine: 15 });
    });

    it("announces a new record with the one it beats", () => {
        const latest = played("latest", 20);
        const history = [latest, played("a", 17), played("b", 5)];

        expect(recordOf(latest, history)).toEqual({
            kind: "new",
            mine: 21,
            previous: 18,
        });
    });

    it("keeps the best older game as the record when this one falls short", () => {
        const latest = played("latest", 4);
        const best = played("best", 17, "2026-10-12T18:00:00Z");
        const history = [latest, played("a", 8), best];

        expect(recordOf(latest, history)).toEqual({
            kind: "held",
            best: 18,
            bestAt: best.game.endsAt,
        });
    });

    it("calls a tie tied, pointing at the latest game that reached it", () => {
        const latest = played("latest", 17);
        const tied = played("tied", 17, "2026-10-19T18:00:00Z");
        const history = [latest, tied, played("older", 17)];

        expect(recordOf(latest, history)).toEqual({
            kind: "tied",
            mine: 18,
            bestAt: tied.game.endsAt,
        });
    });

    it("only looks at the games after the one shown", () => {
        const pending = played("pending", 4);
        const older = played("older", 9);
        const history = [played("newer", 40), pending, older];

        expect(recordOf(pending, history)).toEqual({
            kind: "held",
            best: 10,
            bestAt: older.game.endsAt,
        });
    });

    it("counts the tickets a discarded game earned, not the ones drawn", () => {
        const discarded = {
            ...played("latest", 20),
            discarded: "not_following" as const,
            drawTickets: 0,
        };
        const history = [discarded, played("older", 10)];

        expect(recordOf(discarded, history)).toEqual({
            kind: "new",
            mine: 21,
            previous: 11,
        });
    });
});
