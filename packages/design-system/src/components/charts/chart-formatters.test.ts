import { describe, expect, it } from "vitest";
import {
    getIntFmt,
    getShortDateFmt,
    getWeekdayDateFmt,
} from "./chart-formatters";

const monday = new Date(2026, 0, 5);

describe("chart formatters", () => {
    it("formats a short date as month and day", () => {
        expect(getShortDateFmt("en-US").format(monday)).toBe("Jan 5");
    });

    it("formats a weekday date with the weekday first", () => {
        expect(getWeekdayDateFmt("en-US").format(monday)).toBe("Mon, Jan 5");
    });

    it("formats dates in the requested locale", () => {
        expect(getShortDateFmt("fr-FR").format(monday)).toBe("5 janv.");
    });

    it("groups digits of integers according to the locale", () => {
        expect(getIntFmt("en-US").format(1234567)).toBe("1,234,567");
        expect(getIntFmt("de-DE").format(1234567)).toBe("1.234.567");
    });

    it("reuses one formatter per locale", () => {
        expect(getIntFmt("en-GB")).toBe(getIntFmt("en-GB"));
        expect(getShortDateFmt("en-GB")).toBe(getShortDateFmt("en-GB"));
        expect(getWeekdayDateFmt("en-GB")).toBe(getWeekdayDateFmt("en-GB"));
    });

    it("keeps short and weekday formatters apart for the same locale", () => {
        expect(getShortDateFmt("en-US")).not.toBe(getWeekdayDateFmt("en-US"));
    });
});
