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

        it("should return correct period for global budget", () => {
            const result = getCapPeriod("global");
            expect(result).toBe(281474976710655); // Max uint48
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

        it("should return 0 for null (type coercion)", () => {
            // @ts-expect-error - testing runtime behavior with invalid input
            const result = getCapPeriod(null);
            expect(result).toBe(0);
        });
    });

    describe("period calculations", () => {
        it("should have daily period equal to 1 day in seconds", () => {
            const daily = getCapPeriod("daily");
            const oneDayInSeconds = 24 * 60 * 60;
            expect(daily).toBe(oneDayInSeconds);
        });

        it("should have weekly period equal to 7 days", () => {
            const weekly = getCapPeriod("weekly");
            const daily = getCapPeriod("daily");
            expect(weekly).toBe(daily * 7);
        });

        it("should have monthly period equal to 30 days", () => {
            const monthly = getCapPeriod("monthly");
            const daily = getCapPeriod("daily");
            expect(monthly).toBe(daily * 30);
        });

        it("should have global period much larger than monthly", () => {
            const global = getCapPeriod("global");
            const monthly = getCapPeriod("monthly");
            expect(global).toBeGreaterThan(monthly * 1000);
        });
    });

    describe("consistency", () => {
        it("should return the same value for multiple calls with same input", () => {
            const result1 = getCapPeriod("daily");
            const result2 = getCapPeriod("daily");
            expect(result1).toBe(result2);
        });

        it("should return different values for different budget types", () => {
            const daily = getCapPeriod("daily");
            const weekly = getCapPeriod("weekly");
            const monthly = getCapPeriod("monthly");
            const global = getCapPeriod("global");

            expect(daily).not.toBe(weekly);
            expect(weekly).not.toBe(monthly);
            expect(monthly).not.toBe(global);
        });
    });
});
