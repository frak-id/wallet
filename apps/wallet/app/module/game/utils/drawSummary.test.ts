import { describe, expect, it } from "vitest";
import { publicDraw } from "@/tests/gameFixtures";
import { shortPid, summarizeDraw } from "./drawSummary";

const A = "a1".repeat(16);
const B = "b2".repeat(16);
const C = "c3".repeat(16);
const OUTSIDER = "ff".repeat(16);

describe("summarizeDraw", () => {
    it("reads a frozen draw as scheduled, its round not out yet", () => {
        const summary = summarizeDraw(
            publicDraw({
                status: "frozen",
                candidates: [],
                drand: {
                    ...publicDraw().drand,
                    signature: null,
                    randomness: null,
                },
            }),
            undefined,
            new Date("2026-10-10T19:05:00Z")
        );

        expect(summary.phase).toBe("scheduled");
        expect(summary.drand.published).toBe(false);
        expect(summary.winner).toBeNull();
        expect(summary.payout).toEqual({ state: "none" });
    });

    it("counts a round whose time has passed as published, signature or not", () => {
        const summary = summarizeDraw(
            publicDraw({
                status: "frozen",
                drand: {
                    ...publicDraw().drand,
                    signature: null,
                    randomness: null,
                },
            }),
            undefined,
            new Date("2026-10-10T19:10:01Z")
        );

        expect(summary.drand.published).toBe(true);
    });

    it("reads a drawn draw as the winner being checked", () => {
        const summary = summarizeDraw(publicDraw({ status: "drawn" }));

        expect(summary.phase).toBe("checking");
        expect(summary.drand.published).toBe(true);
        expect(summary.winner).toBeNull();
        expect(summary.payout).toEqual({ state: "none" });
    });

    it("reads a confirmed draw with its winner and a payout still pending", () => {
        const summary = summarizeDraw(
            publicDraw({ status: "confirmed", winnerPid: C })
        );

        expect(summary.phase).toBe("confirmed");
        expect(summary.winner).toEqual({ pid: C, short: "c3c3c3…c3c3" });
        expect(summary.payout).toEqual({ state: "pending" });
    });

    it("reports the transaction once the prize is paid", () => {
        const summary = summarizeDraw(
            publicDraw({
                status: "confirmed",
                winnerPid: C,
                payoutTxHash: "0xabc",
            })
        );

        expect(summary.payout).toEqual({ state: "paid", txHash: "0xabc" });
    });

    it("reads a void draw as no winner", () => {
        const summary = summarizeDraw(
            publicDraw({ status: "void", candidates: [], rejections: [] })
        );

        expect(summary.phase).toBe("noWinner");
        expect(summary.winner).toBeNull();
    });

    it("carries the stats and rebuilds dates from the ISO strings the API sends", () => {
        const wire = JSON.parse(JSON.stringify(publicDraw()));
        const summary = summarizeDraw(wire);

        expect(summary).toMatchObject({
            participants: 3,
            totalTickets: 80,
            drand: { round: 1234 },
        });
        expect(summary.frozenAt).toEqual(new Date("2026-10-10T19:00:00Z"));
        expect(summary.drand.roundTime).toEqual(
            new Date("2026-10-10T19:10:00Z")
        );
    });

    describe("me", () => {
        it("is absent without a pid", () => {
            expect(summarizeDraw(publicDraw()).me).toBeUndefined();
        });

        it("says so when the pid is not in the list", () => {
            expect(summarizeDraw(publicDraw(), OUTSIDER).me).toEqual({
                found: false,
            });
        });

        it("gives a participant their tickets and chance, with no rank outside the candidates", () => {
            expect(summarizeDraw(publicDraw(), B).me).toEqual({
                found: true,
                tickets: 10,
                share: 10 / 80,
                candidateRank: null,
                isWinner: false,
            });
        });

        it("ranks a candidate from 1", () => {
            expect(summarizeDraw(publicDraw(), A).me).toMatchObject({
                found: true,
                candidateRank: 2,
                isWinner: false,
            });
        });

        it("marks the winner", () => {
            expect(
                summarizeDraw(
                    publicDraw({ status: "confirmed", winnerPid: C }),
                    C
                ).me
            ).toMatchObject({ candidateRank: 1, isWinner: true });
        });

        it("does not divide by zero on an empty draw", () => {
            const draw = publicDraw({
                totalTickets: 0,
                entries: [{ pid: A, tickets: 0 }],
            });

            expect(summarizeDraw(draw, A).me).toMatchObject({ share: 0 });
        });
    });
});

describe("shortPid", () => {
    it("keeps the ends of a full pid", () => {
        expect(shortPid(A)).toBe("a1a1a1…a1a1");
    });

    it("leaves a short one alone", () => {
        expect(shortPid("abc123")).toBe("abc123");
    });
});
