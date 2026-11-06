import { describe, expect, it } from "vitest";
import { currentStablecoins } from "./addresses";
import {
    getStablecoinCurrency,
    stablecoinCurrency,
} from "./stablecoinCurrency";

describe("getStablecoinCurrency", () => {
    it("maps EURe to eur and USDC to usd", () => {
        expect(getStablecoinCurrency(currentStablecoins.eure)).toBe("eur");
        expect(getStablecoinCurrency(currentStablecoins.usdc)).toBe("usd");
    });

    it("matches addresses case-insensitively", () => {
        expect(
            getStablecoinCurrency(currentStablecoins.eure.toLowerCase())
        ).toBe("eur");
        expect(
            getStablecoinCurrency(currentStablecoins.usdc.toUpperCase())
        ).toBe("usd");
    });

    it("returns undefined for an unknown or missing token", () => {
        expect(
            getStablecoinCurrency("0x0000000000000000000000000000000000000001")
        ).toBeUndefined();
        expect(getStablecoinCurrency(undefined)).toBeUndefined();
        expect(getStablecoinCurrency("")).toBeUndefined();
    });

    it("exposes the peg per stablecoin name", () => {
        expect(stablecoinCurrency).toEqual({ eure: "eur", usdc: "usd" });
    });
});
