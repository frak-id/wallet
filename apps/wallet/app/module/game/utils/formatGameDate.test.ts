import { describe, expect, it } from "vitest";
import { formatGameDate } from "./formatGameDate";

const now = new Date("2026-10-27T12:00:00Z");

describe("formatGameDate", () => {
    it("drops the year for a date in the current year", () => {
        expect(formatGameDate("2026-10-07T12:00:00Z", "fr-FR", now)).toBe(
            "7 octobre"
        );
    });

    it("keeps the year for a date in an earlier year", () => {
        expect(formatGameDate("2025-12-20T12:00:00Z", "fr-FR", now)).toBe(
            "20 décembre 2025"
        );
    });
});
