import { describe, expect, it } from "vitest";
import {
    parseShopifyGid,
    validateBank,
    validatePurchaseAmount,
} from "./purchase.helpers";

describe("purchase validation", () => {
    describe("amount validation", () => {
        it("rejects non-numeric amount", () => {
            expect(validatePurchaseAmount("abc")).toBe(
                "Amount must be a number"
            );
        });

        it("rejects amount below 10", () => {
            expect(validatePurchaseAmount("5")).toBe(
                "Amount must be greater than 10"
            );
        });

        it("rejects amount above 1000", () => {
            expect(validatePurchaseAmount("1001")).toBe(
                "Amount must be less than 1000"
            );
        });

        it("accepts amount of 10", () => {
            expect(validatePurchaseAmount("10")).toBeNull();
        });

        it("accepts amount of 1000", () => {
            expect(validatePurchaseAmount("1000")).toBeNull();
        });

        it("accepts amount of 500", () => {
            expect(validatePurchaseAmount("500")).toBeNull();
        });

        it("rejects empty string (coerced to 0, below minimum)", () => {
            expect(validatePurchaseAmount("")).toBe(
                "Amount must be greater than 10"
            );
        });
    });

    describe("bank address validation", () => {
        it("accepts valid ethereum address", () => {
            expect(
                validateBank("0x1234567890abcdef1234567890abcdef12345678")
            ).toBeNull();
        });

        it("rejects invalid address", () => {
            expect(validateBank("not-an-address")).toBe(
                "Bank must be a valid address"
            );
        });

        it("rejects empty string", () => {
            expect(validateBank("")).toBe("Bank must be a valid address");
        });
    });
});

describe("purchase name generation", () => {
    it("generates name with amount and timestamp", () => {
        const amount = 100;
        const name = `Frak bank - ${amount.toFixed(2)}usd - ${new Date().toISOString()}`;
        expect(name).toMatch(/^Frak bank - 100\.00usd - \d{4}-\d{2}-\d{2}/);
    });
});

describe("parseShopifyGid", () => {
    it("extracts numeric ID from Shop gid", () => {
        expect(parseShopifyGid("gid://shopify/Shop/12345678", "Shop")).toBe(
            12345678
        );
    });

    it("extracts numeric ID from AppPurchaseOneTime gid", () => {
        expect(
            parseShopifyGid(
                "gid://shopify/AppPurchaseOneTime/87654321",
                "AppPurchaseOneTime"
            )
        ).toBe(87654321);
    });
});
