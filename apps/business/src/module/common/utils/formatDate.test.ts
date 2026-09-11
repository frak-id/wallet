import { describe, expect, it } from "vitest";
import { formatDate } from "./formatDate";

describe("formatDate", () => {
    it("falls back to N/A when the date is invalid", () => {
        expect(formatDate(new Date("not-a-date"))).toBe("N/A");
    });
});
