import { describe, expect, it } from "vitest";
import { formatUsd } from "./mUsdFormatter";

describe("formatUsd", () => {
    describe("basic formatting", () => {
        it("should format integer amounts", () => {
            const result = formatUsd(100);
            expect(result).toContain("100");
            expect(result).toContain("$");
        });

        it("should format decimal amounts", () => {
            const result = formatUsd(100.5);
            expect(result).toContain("100.50");
            expect(result).toContain("$");
        });

        it("should format zero", () => {
            const result = formatUsd(0);
            expect(result).toContain("0");
        });

        it("should format small amounts", () => {
            const result = formatUsd(0.01);
            expect(result).toContain("0.01");
        });
    });

    describe("custom fraction digits", () => {
        it("should respect custom fraction digits for decimal amounts", () => {
            const result = formatUsd(100.123, 3);
            expect(result).toContain("100.123");
        });

        it("should use 0 decimals for integer amounts", () => {
            const result = formatUsd(100, 3);
            expect(result).toContain("100");
            expect(result).not.toContain(".");
        });

        it("should handle 0 fraction digits", () => {
            const result = formatUsd(100.99, 0);
            expect(result).toContain("101");
        });
    });

    describe("thousands separators", () => {
        it("should add thousands separators for large amounts", () => {
            const result = formatUsd(1000);
            expect(result).toContain("1,000");
        });

        it("should handle millions", () => {
            const result = formatUsd(1000000);
            expect(result).toContain("1,000,000");
        });
    });

    describe("negative amounts", () => {
        it("should handle negative amounts", () => {
            const result = formatUsd(-100);
            expect(result).toContain("-");
            expect(result).toContain("100");
        });

        it("should format negative decimals", () => {
            const result = formatUsd(-99.99);
            expect(result).toContain("-");
            expect(result).toContain("99.99");
        });
    });

    describe("return type", () => {
        it("should return a string", () => {
            expect(typeof formatUsd(100)).toBe("string");
            expect(typeof formatUsd(100.5)).toBe("string");
        });

        it("should always include dollar sign", () => {
            expect(formatUsd(0)).toContain("$");
            expect(formatUsd(100)).toContain("$");
            expect(formatUsd(-100)).toContain("$");
        });
    });

    describe("function behavior", () => {
        it("should be deterministic", () => {
            const result1 = formatUsd(123.45);
            const result2 = formatUsd(123.45);
            expect(result1).toBe(result2);
        });

        it("should handle edge case amounts", () => {
            expect(() => formatUsd(0.001, 3)).not.toThrow();
            expect(() => formatUsd(1000000000)).not.toThrow();
            expect(() => formatUsd(-999)).not.toThrow();
        });
    });
});
