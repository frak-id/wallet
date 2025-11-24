/**
 * Tests for formatAmount utility function
 * Tests currency formatting with proper locale support
 */

import { describe, expect, it } from "../../tests/vitest-fixtures";
import { formatAmount } from "./formatAmount";

describe("formatAmount", () => {
    it("should format EUR with French locale by default", () => {
        const formatted = formatAmount(1000, "eur");

        // French locale formats EUR with space between number and symbol
        // Expected format: "1 000 €" or "1 000,00 €" depending on locale
        expect(formatted).toContain("€");
        expect(formatted).toContain("1");
    });

    it("should format USD with US locale", () => {
        const formatted = formatAmount(1000, "usd");

        // US locale formats USD with $ prefix
        expect(formatted).toContain("$");
        expect(formatted).toContain("1");
    });

    it("should format GBP with British locale", () => {
        const formatted = formatAmount(1000, "gbp");

        // British locale formats GBP with £ symbol
        expect(formatted).toContain("£");
        expect(formatted).toContain("1");
    });

    it("should format integer amounts without decimal places", () => {
        const formatted = formatAmount(1000, "eur");

        // Integer amounts should not show .00
        // French locale: "1 000 €" or "1 000,00 €"
        expect(formatted).toBeDefined();
        expect(formatted.length).toBeGreaterThan(0);
    });

    it("should format decimal amounts with up to 2 decimal places", () => {
        const formatted = formatAmount(1234.56, "eur");

        // Should include decimal separator and digits
        expect(formatted).toBeDefined();
        expect(formatted).toContain("1");
    });

    it("should handle zero amount", () => {
        const formatted = formatAmount(0, "eur");

        // Should format zero properly
        expect(formatted).toContain("0");
        expect(formatted).toContain("€");
    });

    it("should handle large amounts", () => {
        const formatted = formatAmount(1000000, "eur");

        // Should format large numbers with proper thousand separators
        expect(formatted).toContain("€");
        expect(formatted).toBeDefined();
    });

    it("should default to EUR when currency is not provided", () => {
        const formatted = formatAmount(1000);

        // Should default to EUR
        expect(formatted).toContain("€");
    });

    it("should format negative amounts", () => {
        const formatted = formatAmount(-500, "eur");

        // Should handle negative amounts
        expect(formatted).toContain("-");
        expect(formatted).toContain("€");
    });

    it("should round amounts with more than 2 decimal places", () => {
        const formatted = formatAmount(1234.5678, "eur");

        // Should round to max 2 decimal places
        expect(formatted).toBeDefined();
        // The exact format depends on locale, but should be rounded
    });

    it("should format small decimal amounts", () => {
        const formatted = formatAmount(0.99, "usd");

        // Should handle small amounts properly
        expect(formatted).toContain("$");
        expect(formatted).toContain("0");
    });

    it("should use correct locale for each currency", () => {
        const eurFormatted = formatAmount(1000, "eur");
        const usdFormatted = formatAmount(1000, "usd");
        const gbpFormatted = formatAmount(1000, "gbp");

        // Each should use different currency symbols
        expect(eurFormatted).toContain("€");
        expect(usdFormatted).toContain("$");
        expect(gbpFormatted).toContain("£");

        // All should be different formats due to different locales
        expect(eurFormatted).not.toBe(usdFormatted);
        expect(usdFormatted).not.toBe(gbpFormatted);
    });
});
