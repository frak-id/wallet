import { describe, expect, it } from "vitest";
import { frakCodeUrl, gamePhase, shortId } from "./format";

const NOW = new Date("2026-11-01T12:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;

const game = (status: string, startOffset: number, endOffset: number) => ({
    status,
    startsAt: new Date(NOW + startOffset).toISOString(),
    endsAt: new Date(NOW + endOffset),
});

describe("gamePhase", () => {
    it.each([
        {
            name: "not started",
            game: game("active", HOUR, 2 * HOUR),
            phase: "upcoming",
        },
        { name: "running", game: game("active", -HOUR, HOUR), phase: "live" },
        {
            name: "paused while running",
            game: game("paused", -HOUR, HOUR),
            phase: "paused",
        },
        {
            name: "paused but over",
            game: game("paused", -2 * HOUR, -HOUR),
            phase: "ended",
        },
        {
            name: "over",
            game: game("active", -2 * HOUR, -HOUR),
            phase: "ended",
        },
    ])("reads a game $name as $phase", ({ game, phase }) => {
        expect(gamePhase(game, NOW)).toBe(phase);
    });
});

describe("shortId", () => {
    it("keeps both ends of a long value", () => {
        expect(shortId("0x1234567890abcdef1234")).toBe("0x1234…1234");
    });

    it("leaves a short value whole", () => {
        expect(shortId("0x12345")).toBe("0x12345");
    });
});

describe("frakCodeUrl", () => {
    it("is uppercase so the QR stays in alphanumeric mode", () => {
        expect(frakCodeUrl("frak26")).toMatch(/^[A-Z0-9:/._-]+\/R\/FRAK26$/);
    });
});
