/**
 * Tests for getSupportedCurrency utility function
 * Tests currency validation and fallback behavior
 */

import { describe, expect, it } from "../../tests/vitest-fixtures";
import type { Currency } from "../types";
import { getSupportedCurrency } from "./getSupportedCurrency";

describe("getSupportedCurrency", () => {
    it("should return EUR for undefined input", () => {
        const result = getSupportedCurrency(undefined);

        expect(result).toBe("eur");
    });

    it("should return EUR when provided", () => {
        const result = getSupportedCurrency("eur");

        expect(result).toBe("eur");
    });

    it("should return USD when provided", () => {
        const result = getSupportedCurrency("usd");

        expect(result).toBe("usd");
    });

    it("should return GBP when provided", () => {
        const result = getSupportedCurrency("gbp");

        expect(result).toBe("gbp");
    });

    it("should fall back to EUR for invalid currency", () => {
        // Force cast to test runtime behavior
        const invalidCurrency = "invalid" as Currency;
        const result = getSupportedCurrency(invalidCurrency);

        expect(result).toBe("eur");
    });

    it("should handle all valid currencies", () => {
        const validCurrencies: Currency[] = ["eur", "usd", "gbp"];

        for (const currency of validCurrencies) {
            const result = getSupportedCurrency(currency);
            expect(result).toBe(currency);
        }
    });
});
