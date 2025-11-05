import { describe, expect, it } from "vitest";
import { formatPrice } from "./formatPrice";

describe("formatPrice", () => {
    describe("currency formatting", () => {
        it("should format USD with default locale", () => {
            const result = formatPrice(100, "en-US", "USD");
            expect(result).toBe("$100.00");
        });

        it("should format EUR with en-US locale", () => {
            const result = formatPrice(100, "en-US", "EUR");
            expect(result).toBe("€100.00");
        });

        it("should format GBP with en-US locale", () => {
            const result = formatPrice(100, "en-US", "GBP");
            expect(result).toBe("£100.00");
        });

        it("should format EUR with fr-FR locale", () => {
            const result = formatPrice(100, "fr-FR", "EUR");
            // French locale formats as "100,00 €" with comma for decimals
            expect(result).toMatch(/100[,\s]00/);
            expect(result).toContain("€");
            expect(result?.length).toBeGreaterThan(5);
        });

        it("should format with default parameters (en-US, USD)", () => {
            const result = formatPrice(100);
            expect(result).toBe("$100.00");
        });
    });

    describe("number vs string inputs", () => {
        it("should handle number input", () => {
            const result = formatPrice(100);
            expect(result).toBe("$100.00");
        });

        it("should handle string input", () => {
            const result = formatPrice("100");
            expect(result).toBe("$100.00");
        });

        it("should handle decimal string input", () => {
            const result = formatPrice("99.99");
            expect(result).toBe("$99.99");
        });

        it("should handle decimal number input", () => {
            const result = formatPrice(99.99);
            expect(result).toBe("$99.99");
        });
    });

    describe("edge cases", () => {
        it("should return undefined for undefined input", () => {
            const result = formatPrice(undefined);
            expect(result).toBeUndefined();
        });

        it("should handle zero", () => {
            const result = formatPrice(0);
            expect(result).toBe("$0.00");
        });

        it("should handle negative numbers", () => {
            const result = formatPrice(-50);
            expect(result).toBe("-$50.00");
        });

        it("should handle very large numbers", () => {
            const result = formatPrice(1000000);
            expect(result).toBe("$1,000,000.00");
        });

        it("should handle very small decimal numbers", () => {
            const result = formatPrice(0.01);
            expect(result).toBe("$0.01");
        });

        it("should handle numbers with many decimal places", () => {
            const result = formatPrice(99.999);
            // Should round to 2 decimal places
            expect(result).toBe("$100.00");
        });
    });

    describe("locale variations", () => {
        it("should format with German locale", () => {
            const result = formatPrice(1234.56, "de-DE", "EUR");
            // German locale uses period for thousands, comma for decimals
            expect(result).toMatch(/1[.\s]234[,\s]56/);
            expect(result).toContain("€");
            expect(result?.length).toBeGreaterThan(7);
        });

        it("should format with Japanese locale", () => {
            const result = formatPrice(1000, "ja-JP", "JPY");
            // Japanese Yen has no decimal places
            expect(result).toContain("1,000");
            // Japanese locale uses full-width yen symbol
            expect(result).toMatch(/[¥￥]/);
        });
    });

    describe("different currencies", () => {
        it("should format with Swiss Franc", () => {
            const result = formatPrice(100, "en-US", "CHF");
            expect(result).toContain("CHF");
            expect(result).toContain("100.00");
            expect(result).toMatch(/CHF\s*100\.00/);
        });

        it("should format with Canadian Dollar", () => {
            const result = formatPrice(100, "en-US", "CAD");
            expect(result).toContain("CA");
            expect(result).toContain("100.00");
            expect(result).toMatch(/CA\$\s*100\.00/);
        });
    });
});
