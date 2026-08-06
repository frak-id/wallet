import { describe, expect, it } from "vitest";
import { formatAmount } from "./formatAmount";
import { formatAmountParts, percentAmountParts } from "./formatAmountParts";

describe("formatAmountParts", () => {
    it("splits a whole EUR amount, synthesising the decimals", () => {
        expect(formatAmountParts(5)).toEqual({
            integer: "5",
            decimals: ",00",
            unit: "€",
            unitPosition: "suffix",
        });
    });

    it("keeps the locale group separators in the integer", () => {
        const parts = formatAmountParts(1500);
        expect(parts.integer.replace(/\s|\u00a0|\u202f/g, " ")).toBe("1 500");
        expect(parts.unit).toBe("€");
    });

    it("splits real decimals rather than synthesising them", () => {
        expect(formatAmountParts(12.5)).toMatchObject({
            integer: "12",
            decimals: ",5",
            unit: "€",
        });
    });

    it("reports a leading symbol as a prefix", () => {
        expect(formatAmountParts(1234.56, "usd")).toMatchObject({
            unit: "$",
            unitPosition: "prefix",
        });
    });

    it("agrees with formatAmount about the number itself", () => {
        for (const amount of [0, 5, 12.5, 1500, 1234.56]) {
            for (const currency of ["eur", "usd", "gbp"] as const) {
                const parts = formatAmountParts(amount, currency);
                const formatted = formatAmount(amount, currency);
                const digits = (s: string) => s.replace(/\D/g, "");
                expect(digits(parts.integer)).toBe(
                    digits(formatted).slice(0, digits(parts.integer).length)
                );
                expect(formatted).toContain(parts.unit);
            }
        }
    });
});

describe("percentAmountParts", () => {
    it("carries no decimals and a trailing unit", () => {
        expect(percentAmountParts(10)).toEqual({
            integer: "10",
            unit: "%",
            unitPosition: "suffix",
        });
    });

    it("takes the percent as sent, without Intl rounding", () => {
        expect(percentAmountParts(7.5).integer).toBe("7.5");
    });
});
