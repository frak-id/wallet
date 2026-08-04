import { describe, expect, it } from "vitest";
import { sanitizeSeededReward } from "./sanitizeSeededReward";

describe("sanitizeSeededReward", () => {
    it("accepts what the reward formatter actually produces", () => {
        // Every supported currency (eur, usd, gbp) formats with a symbol, so a
        // genuine headline is digits plus a symbol and never contains letters.
        for (const [currency, locale] of [
            ["eur", "fr-FR"],
            ["usd", "en-US"],
            ["gbp", "en-GB"],
        ]) {
            for (const amount of [0, 1.5, 9.99, 1234.56, 999999.99]) {
                const formatted = amount.toLocaleString(locale, {
                    style: "currency",
                    currency,
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                });
                expect(sanitizeSeededReward(formatted)).toBe(formatted);
            }
        }
    });

    it("accepts percentage headlines", () => {
        expect(sanitizeSeededReward("10 %")).toBe("10 %");
        expect(sanitizeSeededReward("10%")).toBe("10%");
    });

    it("trims surrounding whitespace", () => {
        expect(sanitizeSeededReward("  12,50 €  ")).toBe("12,50 €");
    });

    it("drops prose, even when it carries a number", () => {
        // The qualifier ("up to") is added by the page from its own
        // translations, so no legitimate value contains words.
        expect(sanitizeSeededReward("1 free iPhone")).toBeUndefined();
        expect(sanitizeSeededReward("10 EUR bonus now")).toBeUndefined();
        expect(sanitizeSeededReward("1 Verify your wallet")).toBeUndefined();
        expect(sanitizeSeededReward("50% off scam")).toBeUndefined();
        expect(sanitizeSeededReward("Congratulations")).toBeUndefined();
        expect(sanitizeSeededReward("1 (Free اختبار)")).toBeUndefined();
    });

    it("drops markup and control characters", () => {
        expect(sanitizeSeededReward("<img src=x onerror=1>")).toBeUndefined();
        expect(sanitizeSeededReward("12,50 €<b>")).toBeUndefined();
        expect(sanitizeSeededReward("12,50\u0000")).toBeUndefined();
        expect(sanitizeSeededReward("12,50\n€")).toBeUndefined();
    });

    it("drops a bare number with no unit", () => {
        expect(sanitizeSeededReward("1234")).toBeUndefined();
    });

    it("drops values too long to be a reward headline", () => {
        const atLimit = `${"1".repeat(31)}€`;
        expect(atLimit).toHaveLength(32);
        expect(sanitizeSeededReward(atLimit)).toBe(atLimit);
        expect(sanitizeSeededReward(`${"1".repeat(32)}€`)).toBeUndefined();
    });

    it("drops empty and non-string input", () => {
        expect(sanitizeSeededReward("")).toBeUndefined();
        expect(sanitizeSeededReward("   ")).toBeUndefined();
        expect(sanitizeSeededReward(undefined)).toBeUndefined();
        expect(sanitizeSeededReward(42)).toBeUndefined();
    });
});
