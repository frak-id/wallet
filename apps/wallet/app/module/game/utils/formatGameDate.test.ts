import { describe, expect, it } from "vitest";
import {
    formatGameDate,
    formatGameDeadline,
    formatGameEnd,
} from "./formatGameDate";

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

describe("formatGameEnd", () => {
    it("names the weekday and the minute the game ends", () => {
        expect(formatGameEnd(new Date(2026, 9, 30, 18, 5), "fr-FR")).toBe(
            "vendredi 30 octobre à 18:05"
        );
    });
});

describe("formatGameDeadline", () => {
    it("fits a deadline on one card line", () => {
        expect(formatGameDeadline(new Date(2026, 9, 30, 12, 8), "fr-FR")).toBe(
            "30 oct., 12:08"
        );
    });
});
