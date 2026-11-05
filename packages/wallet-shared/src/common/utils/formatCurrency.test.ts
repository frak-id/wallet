import { describe, expect, it } from "vitest";
import { formatCurrency } from "./formatCurrency";

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
