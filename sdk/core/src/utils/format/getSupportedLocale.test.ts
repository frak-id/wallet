import { describe, expect, it } from "../../../tests/vitest-fixtures";
import type { Currency } from "../../types";
import { getSupportedLocale } from "./getSupportedLocale";

describe("getSupportedLocale", () => {
    it.each([
        ["eur", "fr-FR"],
        ["usd", "en-US"],
        ["gbp", "en-GB"],
    ] as const)("should map %s to %s", (currency, locale) => {
        expect(getSupportedLocale(currency)).toBe(locale);
    });

    it("should return the EUR locale for undefined input", () => {
        expect(getSupportedLocale(undefined)).toBe("fr-FR");
    });

    it("should fall back to the EUR locale for an unsupported currency", () => {
        expect(getSupportedLocale("invalid" as Currency)).toBe("fr-FR");
    });
});
