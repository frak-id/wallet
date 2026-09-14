import { describe, expect, it } from "../../../tests/vitest-fixtures";
import type { Currency } from "../../types";
import { getSupportedCurrency } from "./getSupportedCurrency";

describe("getSupportedCurrency", () => {
    it.each<Currency>(["eur", "usd", "gbp"])(
        "should return %s when provided",
        (currency) => {
            expect(getSupportedCurrency(currency)).toBe(currency);
        }
    );

    it("should return EUR for undefined input", () => {
        expect(getSupportedCurrency(undefined)).toBe("eur");
    });

    it("should fall back to EUR for an unsupported currency", () => {
        expect(getSupportedCurrency("invalid" as Currency)).toBe("eur");
    });
});
