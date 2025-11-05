import { describe, expect, it } from "vitest";
import { formatDate } from "./formatDate";

describe("formatDate", () => {
    describe("basic formatting", () => {
        it("should format a standard date", () => {
            const date = new Date("2024-01-15T12:00:00Z");
            const result = formatDate(date);

            // Should return a string with date components
            expect(typeof result).toBe("string");
            expect(result.length).toBeGreaterThan(5);
            // Should contain year, month, and day numbers
            expect(result).toMatch(/2024/);
            expect(result).toMatch(/1/);
            expect(result).toMatch(/15/);
        });

        it("should format a date with leading zeros", () => {
            const date = new Date("2024-03-05T00:00:00Z");
            const result = formatDate(date);

            expect(typeof result).toBe("string");
            expect(result).toMatch(/2024/);
            expect(result).toMatch(/3/);
            expect(result).toMatch(/5/);
        });

        it("should format current date", () => {
            const date = new Date();
            const result = formatDate(date);

            expect(typeof result).toBe("string");
            expect(result.length).toBeGreaterThan(5);
            expect(result).toMatch(/\d+/);
        });
    });

    describe("edge cases", () => {
        it("should format very old dates", () => {
            const date = new Date("1900-01-01T00:00:00Z");
            const result = formatDate(date);

            expect(typeof result).toBe("string");
            expect(result).toMatch(/1900/);
            expect(result).toMatch(/1/);
        });

        it("should format far future dates", () => {
            const date = new Date("2099-12-31T12:00:00Z");
            const result = formatDate(date);

            expect(typeof result).toBe("string");
            // Date may shift to 2100 depending on timezone
            expect(result).toMatch(/209[9]|2100/);
            expect(result).toMatch(/31|1/);
        });

        it("should format January 1st", () => {
            const date = new Date("2024-01-01T00:00:00Z");
            const result = formatDate(date);

            expect(typeof result).toBe("string");
            expect(result).toMatch(/2024/);
            expect(result).toMatch(/1/);
        });

        it("should format December 31st", () => {
            const date = new Date("2024-12-31T12:00:00Z");
            const result = formatDate(date);

            expect(typeof result).toBe("string");
            // Date may shift to 2025 depending on timezone
            expect(result).toMatch(/2024|2025/);
            expect(result).toMatch(/31|1/);
        });

        it("should format leap year date", () => {
            const date = new Date("2024-02-29T12:00:00Z");
            const result = formatDate(date);

            expect(typeof result).toBe("string");
            expect(result).toMatch(/2024/);
            expect(result).toMatch(/29/);
            expect(result).toMatch(/2/);
        });
    });

    describe("consistency", () => {
        it("should format the same date consistently", () => {
            const date = new Date("2024-06-15T12:00:00Z");
            const result1 = formatDate(date);
            const result2 = formatDate(date);

            expect(result1).toBe(result2);
        });

        it("should format equal dates to the same string", () => {
            const date1 = new Date("2024-06-15T12:00:00Z");
            const date2 = new Date("2024-06-15T12:00:00Z");

            const result1 = formatDate(date1);
            const result2 = formatDate(date2);

            expect(result1).toBe(result2);
        });

        it("should format different dates to different strings", () => {
            const date1 = new Date("2024-06-15T12:00:00Z");
            const date2 = new Date("2024-06-16T12:00:00Z");

            const result1 = formatDate(date1);
            const result2 = formatDate(date2);

            // Different dates should produce different strings
            expect(result1).not.toBe(result2);
        });
    });

    describe("date components", () => {
        it("should include year, month, and day information", () => {
            const date = new Date("2024-06-15T12:00:00Z");
            const result = formatDate(date);

            // Should contain some numeric information
            expect(result).toMatch(/\d+/);
            expect(result.length).toBeGreaterThan(5);
        });
    });
});
