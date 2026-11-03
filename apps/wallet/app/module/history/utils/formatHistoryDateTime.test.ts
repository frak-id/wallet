import type { TFunction } from "i18next";
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";
import { formatHistoryDateTime } from "./formatHistoryDateTime";

const t = ((key: string) => key) as unknown as TFunction;
const at = (month: number, day: number) =>
    new Date(2026, month, day, 14, 2).getTime();

describe("formatHistoryDateTime", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(2026, 9, 16, 18, 0));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("names today and yesterday, then falls back to day and month", () => {
        expect(formatHistoryDateTime(at(9, 16), "en", t)).toMatch(
            /^common\.today, /
        );
        expect(formatHistoryDateTime(at(9, 15), "en", t)).toMatch(
            /^common\.yesterday, /
        );
        expect(formatHistoryDateTime(at(2, 12), "en", t)).toMatch(
            /^March 12, /
        );
    });

    test("joins the day and the time with the given separator", () => {
        expect(formatHistoryDateTime(at(9, 16), "en", t, " · ")).toMatch(
            /^common\.today · /
        );
    });

    test("yesterday follows the calendar across a month boundary", () => {
        vi.setSystemTime(new Date(2026, 10, 1, 9, 0));
        expect(formatHistoryDateTime(at(9, 31), "en", t)).toMatch(
            /^common\.yesterday, /
        );
    });

    test("an invalid timestamp renders nothing", () => {
        expect(formatHistoryDateTime(Number.NaN, "en", t)).toBe("");
    });
});
