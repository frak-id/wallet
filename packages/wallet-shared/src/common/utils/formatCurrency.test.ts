import { describe, expect, it } from "vitest";
import { formatCurrency, formatRewardAmount } from "./formatCurrency";

describe("formatCurrency", () => {
    it.each([
        ["en-US", 1234.5, "€1,234.50"],
        ["fr-FR", 1234.5, "1\u00a0234,50\u00a0€"],
        ["fr-FR", 1234567, "1\u00a0234\u00a0567,00\u00a0€"],
        ["fr-FR", 0, "0\u00a0€"],
    ])("formats %s %d as %s", (locale, amount, expected) => {
        expect(formatCurrency(amount, "EUR", locale)).toBe(expected);
    });
});

describe("formatRewardAmount", () => {
    it.each([
        [8.7, "gbp", "\u00a38.70"],
        [4.35, "gbp", "\u00a34.35"],
        [9, "gbp", "\u00a39"],
        [8.999, "usd", "$9"],
        [2.5, "eur", "2,50\u00a0\u20ac"],
        [1234.5, "eur", "1\u00a0234,50\u00a0\u20ac"],
    ] as const)("formats %d %s as %s", (amount, currency, expected) => {
        expect(formatRewardAmount(amount, currency)).toBe(expected);
    });
});
