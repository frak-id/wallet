/**
 * Tests for getSupportedLocale utility function
 * Tests locale resolution from currency
 */

import { describe, expect, it } from "../../tests/vitest-fixtures";
import { locales } from "../constants/locales";
import type { Currency } from "../types";
import { getSupportedLocale } from "./getSupportedLocale";

describe("getSupportedLocale", () => {
    it("should return EUR locale for undefined input", () => {
        const result = getSupportedLocale(undefined);

        expect(result).toBe(locales.eur);
        expect(result).toBe("fr-FR");
    });

    it("should return French locale for EUR", () => {
        const result = getSupportedLocale("eur");

        expect(result).toBe(locales.eur);
        expect(result).toBe("fr-FR");
    });

    it("should return US locale for USD", () => {
        const result = getSupportedLocale("usd");

        expect(result).toBe(locales.usd);
        expect(result).toBe("en-US");
    });

    it("should return GB locale for GBP", () => {
        const result = getSupportedLocale("gbp");

        expect(result).toBe(locales.gbp);
        expect(result).toBe("en-GB");
    });

    it("should fall back to EUR locale for invalid currency", () => {
        // Force cast to test runtime behavior
        const invalidCurrency = "invalid" as Currency;
        const result = getSupportedLocale(invalidCurrency);

        expect(result).toBe(locales.eur);
        expect(result).toBe("fr-FR");
    });

    it("should return valid locale format", () => {
        const validCurrencies: Currency[] = ["eur", "usd", "gbp"];

        for (const currency of validCurrencies) {
            const result = getSupportedLocale(currency);
            // Should match locale format like "en-US", "fr-FR", etc.
            expect(result).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
        }
    });

    it("should map all supported currencies to their locales", () => {
        expect(getSupportedLocale("eur")).toBe("fr-FR");
        expect(getSupportedLocale("usd")).toBe("en-US");
        expect(getSupportedLocale("gbp")).toBe("en-GB");
    });
});
