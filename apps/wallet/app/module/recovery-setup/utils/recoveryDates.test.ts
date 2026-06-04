import { describe, expect, test } from "@/tests/vitest-fixtures";
import { isValidDateRange } from "./recoveryDates";

describe("isValidDateRange", () => {
    test("accepts a window that opens before it closes", () => {
        expect(isValidDateRange(1_000, 2_000)).toBe(true);
    });

    test("rejects a start after the end", () => {
        expect(isValidDateRange(2_000, 1_000)).toBe(false);
    });

    test("rejects a start equal to the end", () => {
        expect(isValidDateRange(1_000, 1_000)).toBe(false);
    });

    test("treats validUntil 0 as never expiring", () => {
        expect(isValidDateRange(2_000, 0)).toBe(true);
    });
});
