/**
 * Tests for productTypes constants
 * Tests product type definitions and bitmask calculations
 */

import { describe, expect, it } from "vitest";
import { productTypes, productTypesMask } from "./productTypes";

describe("productTypes", () => {
    describe("structure", () => {
        it("should have all expected product types", () => {
            expect(productTypes).toHaveProperty("dapp");
            expect(productTypes).toHaveProperty("press");
            expect(productTypes).toHaveProperty("webshop");
            expect(productTypes).toHaveProperty("retail");
            expect(productTypes).toHaveProperty("referral");
            expect(productTypes).toHaveProperty("purchase");
        });

        it("should have correct numeric values", () => {
            expect(productTypes.dapp).toBe(1);
            expect(productTypes.press).toBe(2);
            expect(productTypes.webshop).toBe(3);
            expect(productTypes.retail).toBe(4);
            expect(productTypes.referral).toBe(30);
            expect(productTypes.purchase).toBe(31);
        });
    });

    describe("productTypesMask", () => {
        it("should have masks for all product types", () => {
            expect(productTypesMask).toHaveProperty("dapp");
            expect(productTypesMask).toHaveProperty("press");
            expect(productTypesMask).toHaveProperty("webshop");
            expect(productTypesMask).toHaveProperty("retail");
            expect(productTypesMask).toHaveProperty("referral");
            expect(productTypesMask).toHaveProperty("purchase");
        });

        it("should calculate correct bitmask for dapp (value 1)", () => {
            expect(productTypesMask.dapp).toBe(BigInt(1) << BigInt(1));
            expect(productTypesMask.dapp).toBe(BigInt(2));
        });

        it("should calculate correct bitmask for press (value 2)", () => {
            expect(productTypesMask.press).toBe(BigInt(1) << BigInt(2));
            expect(productTypesMask.press).toBe(BigInt(4));
        });

        it("should calculate correct bitmask for webshop (value 3)", () => {
            expect(productTypesMask.webshop).toBe(BigInt(1) << BigInt(3));
            expect(productTypesMask.webshop).toBe(BigInt(8));
        });

        it("should calculate correct bitmask for retail (value 4)", () => {
            expect(productTypesMask.retail).toBe(BigInt(1) << BigInt(4));
            expect(productTypesMask.retail).toBe(BigInt(16));
        });

        it("should calculate correct bitmask for referral (value 30)", () => {
            expect(productTypesMask.referral).toBe(BigInt(1) << BigInt(30));
            expect(productTypesMask.referral).toBe(BigInt(1073741824));
        });

        it("should calculate correct bitmask for purchase (value 31)", () => {
            expect(productTypesMask.purchase).toBe(BigInt(1) << BigInt(31));
            expect(productTypesMask.purchase).toBe(BigInt(2147483648));
        });

        it("should have all masks as BigInt values", () => {
            Object.values(productTypesMask).forEach((mask) => {
                expect(typeof mask).toBe("bigint");
            });
        });

        it("should have unique mask values", () => {
            const maskValues = Object.values(productTypesMask);
            const uniqueValues = new Set(maskValues);
            expect(maskValues.length).toBe(uniqueValues.size);
        });
    });

    describe("bitmask calculation", () => {
        it("should correctly calculate bitmask from product type value", () => {
            // Verify the formula: 1 << value
            expect(productTypesMask.dapp).toBe(
                BigInt(1) << BigInt(productTypes.dapp)
            );
            expect(productTypesMask.press).toBe(
                BigInt(1) << BigInt(productTypes.press)
            );
            expect(productTypesMask.webshop).toBe(
                BigInt(1) << BigInt(productTypes.webshop)
            );
            expect(productTypesMask.retail).toBe(
                BigInt(1) << BigInt(productTypes.retail)
            );
            expect(productTypesMask.referral).toBe(
                BigInt(1) << BigInt(productTypes.referral)
            );
            expect(productTypesMask.purchase).toBe(
                BigInt(1) << BigInt(productTypes.purchase)
            );
        });

        it("should have masks that are powers of 2", () => {
            Object.values(productTypesMask).forEach((mask) => {
                // A power of 2 has exactly one bit set
                // Check: mask & (mask - 1n) should be 0n
                const isPowerOfTwo = mask > 0n && (mask & (mask - 1n)) === 0n;
                expect(isPowerOfTwo).toBe(true);
            });
        });
    });

    describe("type safety", () => {
        it("should have consistent structure", () => {
            const productKeys = Object.keys(productTypes);
            const maskKeys = Object.keys(productTypesMask);
            expect(productKeys.sort()).toEqual(maskKeys.sort());
        });

        it("should have numeric values for product types", () => {
            Object.values(productTypes).forEach((value) => {
                expect(typeof value).toBe("number");
                expect(Number.isInteger(value)).toBe(true);
            });
        });
    });
});
