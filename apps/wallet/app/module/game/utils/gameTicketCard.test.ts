import type { CurrentGameResponse } from "@frak-labs/backend-elysia/domain/game/schemas";
import { describe, expect, it } from "vitest";
import { ticketCardOf } from "./gameTicketCard";

const SOURCES = {
    join: 1,
    instagramCertified: 0,
    purchase: 0,
    referredPurchase: 0,
    referredSignup: 0,
    brandShare: 0,
};

const me = (
    instagram: "certified" | "declared" | "none",
    eligible: boolean,
    sources: Partial<typeof SOURCES> = {},
    participating = true
): CurrentGameResponse["me"] => {
    const ticketsBySource = { ...SOURCES, ...sources };
    return {
        participating,
        tickets: Object.values(ticketsBySource).reduce((a, b) => a + b, 0),
        ticketsBySource,
        eligible,
        instagram,
    };
};

describe("ticketCardOf", () => {
    it("leads a player who has not joined to the code screen", () => {
        expect(ticketCardOf(me("none", false, {}, false))).toEqual({
            kind: "join",
        });
    });

    it("locks on the Instagram gate when the account is not connected", () => {
        const status = ticketCardOf(me("none", false));
        expect(status).toMatchObject({
            kind: "locked",
            mission: { id: "instagram", status: "gate" },
        });
    });

    it("locks on the Instagram gate when the player no longer follows", () => {
        const status = ticketCardOf(me("certified", false, { purchase: 3 }));
        expect(status).toMatchObject({
            kind: "locked",
            mission: {
                id: "instagram",
                title: "game.page.missions.instagram.notFollowing.title",
            },
        });
    });

    it("asks a declared player to connect, as the next mission", () => {
        const status = ticketCardOf(me("declared", true));
        expect(status).toMatchObject({
            kind: "next",
            mission: { id: "instagram", status: "todo" },
        });
    });

    it("moves on to the first mission not done", () => {
        const status = ticketCardOf(
            me("certified", true, { instagramCertified: 2 })
        );
        expect(status).toMatchObject({
            kind: "next",
            mission: { id: "friend" },
        });
    });

    it("skips a done friend mission to the purchase one", () => {
        const status = ticketCardOf(
            me("certified", true, { instagramCertified: 2, referredSignup: 1 })
        );
        expect(status).toMatchObject({
            kind: "next",
            mission: { id: "purchase" },
        });
    });

    it("is done when every mission is", () => {
        const status = ticketCardOf(
            me("certified", true, {
                instagramCertified: 2,
                purchase: 3,
                referredSignup: 1,
            })
        );
        expect(status).toEqual({ kind: "allDone" });
    });
});
