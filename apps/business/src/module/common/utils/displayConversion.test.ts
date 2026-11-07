import { currentStablecoins } from "@frak-labs/app-essentials";
import { describe, expect, it } from "vitest";
import {
    conversionRate,
    formatConversionRate,
    resolveDisplayCurrency,
    resolvePayoutCurrency,
} from "./displayConversion";

describe("resolvePayoutCurrency", () => {
    it("maps each stablecoin to its peg", () => {
        expect(resolvePayoutCurrency(currentStablecoins.eure)).toBe("eur");
        expect(resolvePayoutCurrency(currentStablecoins.usdc)).toBe("usd");
    });

    it("falls back to EUR for an unknown or missing token", () => {
        expect(
            resolvePayoutCurrency("0x0000000000000000000000000000000000000001")
        ).toBe("eur");
        expect(resolvePayoutCurrency(undefined)).toBe("eur");
    });
});

describe("resolveDisplayCurrency", () => {
    it("resolves Auto (empty or missing) to EUR", () => {
        expect(resolveDisplayCurrency("")).toBe("eur");
        expect(resolveDisplayCurrency(null)).toBe("eur");
        expect(resolveDisplayCurrency(undefined)).toBe("eur");
    });

    it("keeps a supported currency and normalises an unsupported one", () => {
        expect(resolveDisplayCurrency("gbp")).toBe("gbp");
        expect(resolveDisplayCurrency("jpy")).toBe("eur");
    });
});

describe("conversionRate", () => {
    const rates = { eur: 1, usd: 1.08, gbp: 0.87 };

    it("is the display price over the payout price", () => {
        expect(conversionRate(rates, "gbp", "eur")).toBeCloseTo(0.87);
        expect(conversionRate(rates, "eur", "usd")).toBeCloseTo(1 / 1.08);
    });

    it("is undefined without usable rates", () => {
        expect(conversionRate(null, "gbp", "eur")).toBeUndefined();
        expect(conversionRate({ eur: 1 }, "gbp", "eur")).toBeUndefined();
    });
});

describe("formatConversionRate", () => {
    it("renders one payout unit in the display currency", () => {
        expect(formatConversionRate(0.87, "gbp", "eur", "en")).toBe(
            "€1 = £0.87"
        );
    });
});
