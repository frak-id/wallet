import { describe, expect, it } from "vitest";
import {
    isInstagramEligible,
    mockIgsidOf,
    normalizeInstagramHandle,
    pickSurvivingLink,
} from "./utils";

describe("normalizeInstagramHandle", () => {
    it.each([
        ["frak_fr", "frak_fr"],
        ["@Frak_FR", "frak_fr"],
        ["  @some.user_01  ", "some.user_01"],
        ["a".repeat(30), "a".repeat(30)],
    ])("accepts %j as %j", (raw, expected) => {
        expect(normalizeInstagramHandle(raw)).toBe(expected);
    });

    it.each([
        ["empty", ""],
        ["only an @", "@"],
        ["a space inside", "frak fr"],
        ["a dash", "frak-fr"],
        ["an accent", "frák"],
        ["a url", "instagram.com/frak_fr"],
        ["over 30 characters", "a".repeat(31)],
    ])("rejects %s", (_name, raw) => {
        expect(normalizeInstagramHandle(raw)).toBeNull();
    });
});

describe("mockIgsidOf", () => {
    it("is stable per handle and never looks like a Meta id", () => {
        expect(mockIgsidOf("frak_fr")).toBe(mockIgsidOf("frak_fr"));
        expect(mockIgsidOf("frak_fr")).not.toBe(mockIgsidOf("other"));
        expect(mockIgsidOf("frak_fr")).toMatch(/^mock_/);
    });
});

const ANCHOR = "anchor";
const link = (
    id: string,
    over: Partial<{
        identityGroupId: string;
        follows: boolean;
        checkedAt: Date;
    }> = {}
) => ({
    id,
    identityGroupId: id,
    follows: false,
    checkedAt: new Date("2026-10-01T00:00:00Z"),
    ...over,
});

describe("pickSurvivingLink", () => {
    it("returns null when nobody linked anything", () => {
        expect(pickSurvivingLink([], ANCHOR)).toBeNull();
    });

    it("keeps the only link, whichever group holds it", () => {
        const loser = link("loser");

        expect(pickSurvivingLink([loser], ANCHOR)).toBe(loser);
    });

    it("prefers a follower over the anchor's own non-follower", () => {
        const anchor = link(ANCHOR);
        const loser = link("loser", { follows: true });

        expect(pickSurvivingLink([anchor, loser], ANCHOR)).toBe(loser);
    });

    it("prefers the anchor's link when both follow", () => {
        const anchor = link(ANCHOR, { follows: true });
        const loser = link("loser", {
            follows: true,
            checkedAt: new Date("2026-10-20T00:00:00Z"),
        });

        expect(pickSurvivingLink([loser, anchor], ANCHOR)).toBe(anchor);
    });

    it("takes the freshest check among losers when the anchor has none", () => {
        const stale = link("stale");
        const fresh = link("fresh", {
            checkedAt: new Date("2026-10-20T00:00:00Z"),
        });

        expect(pickSurvivingLink([stale, fresh], ANCHOR)).toBe(fresh);
    });

    it("breaks a full tie by id so the survivor does not depend on row order", () => {
        const a = link("a");
        const b = link("b");

        expect(pickSurvivingLink([b, a], ANCHOR)).toBe(a);
        expect(pickSurvivingLink([a, b], ANCHOR)).toBe(a);
    });
});

describe("isInstagramEligible", () => {
    it.each([
        ["no link", null, false],
        ["a link that does not follow", { follows: false }, false],
        ["a link that follows", { follows: true }, true],
    ])("is decided by %s", (_name, link, expected) => {
        expect(isInstagramEligible(link)).toBe(expected);
    });
});
