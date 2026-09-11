import { describe, expect, it } from "vitest";
import { getCapPeriod } from "./capPeriods";

describe("getCapPeriod", () => {
    describe("valid budget types", () => {
        it("should return correct period for daily budget", () => {
            const result = getCapPeriod("daily");
            expect(result).toBe(24 * 60 * 60); // 86400 seconds
        });

        it("should return correct period for weekly budget", () => {
            const result = getCapPeriod("weekly");
            expect(result).toBe(7 * 24 * 60 * 60); // 604800 seconds
        });

        it("should return correct period for monthly budget", () => {
            const result = getCapPeriod("monthly");
            expect(result).toBe(30 * 24 * 60 * 60); // 2592000 seconds
        });

        it("should return null for global budget (no time cap)", () => {
            const result = getCapPeriod("global");
            expect(result).toBeNull();
        });
    });

    describe("edge cases", () => {
        it("should return 0 for empty string", () => {
            const result = getCapPeriod("");
            expect(result).toBe(0);
        });

        it("should return 0 for undefined", () => {
            const result = getCapPeriod(undefined);
            expect(result).toBe(0);
        });
    });
});
