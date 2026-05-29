import { describe, expect, it } from "vitest";
import { toFiatCurrency } from "./rewards";

describe("toFiatCurrency", () => {
    it("uppercases the lowercase currency codes sent by the frontend", () => {
        expect(toFiatCurrency("eur")).toBe("EUR");
        expect(toFiatCurrency("usd")).toBe("USD");
        expect(toFiatCurrency("gbp")).toBe("GBP");
    });

    it("passes through already-uppercase codes", () => {
        expect(toFiatCurrency("EUR")).toBe("EUR");
        expect(toFiatCurrency("USD")).toBe("USD");
        expect(toFiatCurrency("GBP")).toBe("GBP");
    });

    it("falls back to EUR for undefined, empty or unsupported codes", () => {
        expect(toFiatCurrency(undefined)).toBe("EUR");
        expect(toFiatCurrency("")).toBe("EUR");
        expect(toFiatCurrency("jpy")).toBe("EUR");
    });
});
