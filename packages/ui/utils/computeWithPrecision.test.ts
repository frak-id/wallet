/**
 * Tests for computeWithPrecision utility function
 * Tests precision calculations to avoid floating point errors
 */

import { describe, expect, it } from "vitest";
import { computeWithPrecision } from "./computeWithPrecision";

describe("computeWithPrecision", () => {
    describe("addition", () => {
        it("should add two numbers with default operator", () => {
            const result = computeWithPrecision(0.1, 0.2);

            expect(result).toBe(0.3);
        });

        it("should add two numbers explicitly", () => {
            const result = computeWithPrecision(0.1, 0.2, "+");

            expect(result).toBe(0.3);
        });

        it("should handle floating point precision errors", () => {
            // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
            const result = computeWithPrecision(0.1, 0.2, "+");

            expect(result).toBe(0.3);
            expect(result).not.toBe(0.30000000000000004);
        });

        it("should add larger numbers correctly", () => {
            const result = computeWithPrecision(1.5, 2.3, "+");

            expect(result).toBe(3.8);
        });

        it("should add negative numbers", () => {
            const result = computeWithPrecision(-1.5, 2.3, "+");

            expect(result).toBe(0.8);
        });

        it("should add zero", () => {
            const result = computeWithPrecision(5.5, 0, "+");

            expect(result).toBe(5.5);
        });

        it("should handle decimal precision", () => {
            const result = computeWithPrecision(0.001, 0.002, "+");

            expect(result).toBe(0.003);
        });
    });

    describe("subtraction", () => {
        it("should subtract two numbers", () => {
            const result = computeWithPrecision(0.3, 0.1, "-");

            expect(result).toBe(0.2);
        });

        it("should handle negative results", () => {
            const result = computeWithPrecision(0.1, 0.3, "-");

            expect(result).toBe(-0.2);
        });

        it("should handle floating point precision errors in subtraction", () => {
            const result = computeWithPrecision(0.3, 0.1, "-");

            expect(result).toBe(0.2);
        });

        it("should subtract larger numbers correctly", () => {
            const result = computeWithPrecision(5.7, 2.3, "-");

            expect(result).toBe(3.4);
        });

        it("should subtract zero", () => {
            const result = computeWithPrecision(5.5, 0, "-");

            expect(result).toBe(5.5);
        });
    });

    describe("multiplication", () => {
        it("should multiply two numbers", () => {
            const result = computeWithPrecision(2, 3, "*");

            expect(result).toBe(6);
        });

        it("should handle decimal multiplication", () => {
            const result = computeWithPrecision(0.5, 0.5, "*");

            expect(result).toBe(0.25);
        });

        it("should handle floating point precision errors in multiplication", () => {
            const result = computeWithPrecision(0.1, 0.2, "*");

            expect(result).toBe(0.02);
        });

        it("should multiply by zero", () => {
            const result = computeWithPrecision(5.5, 0, "*");

            expect(result).toBe(0);
        });

        it("should multiply negative numbers", () => {
            const result = computeWithPrecision(-2, 3, "*");

            expect(result).toBe(-6);
        });

        it("should handle custom precision for multiplication", () => {
            // With precision 100: (2 * 100) * (3 * 100) / 100 / 100 = 6
            const result = computeWithPrecision(2, 3, "*", 100);

            expect(result).toBe(6);
        });
    });

    describe("custom precision", () => {
        it("should use custom precision value", () => {
            const result = computeWithPrecision(0.1, 0.2, "+", 100);

            expect(result).toBe(0.3);
        });

        it("should handle different precision values", () => {
            const result1 = computeWithPrecision(0.1, 0.2, "+", 10);
            const result2 = computeWithPrecision(0.1, 0.2, "+", 1000);

            expect(result1).toBe(0.3);
            expect(result2).toBe(0.3);
        });

        it("should work with multiplication and custom precision", () => {
            // With precision 10: (2 * 10) * (3 * 10) / 10 / 10 = 6
            const result = computeWithPrecision(2, 3, "*", 10);

            expect(result).toBe(6);
        });
    });

    describe("edge cases", () => {
        it("should handle very small numbers", () => {
            // Default precision 1000 may not be enough for very small numbers
            // The function still has floating point limitations with very small values
            const result = computeWithPrecision(0.0001, 0.0002, "+");

            // Result may have slight floating point imprecision
            expect(result).toBeCloseTo(0.0003, 10);
        });

        it("should handle very large numbers", () => {
            const result = computeWithPrecision(1000.5, 2000.3, "+");

            expect(result).toBe(3000.8);
        });

        it("should handle identical numbers", () => {
            const result = computeWithPrecision(5.5, 5.5, "+");

            expect(result).toBe(11);
        });
    });
});
