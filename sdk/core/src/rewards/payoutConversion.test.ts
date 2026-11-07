import { describe, expect, it } from "vitest";
import type { EstimatedReward, TokenAmountType } from "../types";
import { getPayoutConversion } from "./payoutConversion";

// 1 EURe = 1.15 USD = 0.87 GBP
function eure(amount: number): TokenAmountType {
    return {
        amount,
        eurAmount: amount,
        usdAmount: amount * 1.15,
        gbpAmount: amount * 0.87,
    };
}

const fixed = (amount: number): EstimatedReward => ({
    payoutType: "fixed",
    amount: eure(amount),
});

describe("getPayoutConversion", () => {
    it("reports an EUR payout shown in GBP with its rate and amount", () => {
        const conversion = getPayoutConversion(fixed(10), {
            displayCurrency: "gbp",
            payoutCurrency: "eur",
            locale: "en",
        });

        expect(conversion).toMatchObject({
            displayCurrency: "gbp",
            payoutCurrency: "eur",
            formattedRate: "€1 = £0.87",
            payoutAmount: "€10",
        });
        expect(conversion?.rate).toBeCloseTo(0.87);
    });

    it("formats strings for the requested locale", () => {
        const conversion = getPayoutConversion(fixed(10), {
            displayCurrency: "gbp",
            payoutCurrency: "eur",
            locale: "fr",
        });

        expect(conversion?.payoutAmount).toBe("10\u00a0€");
        expect(conversion?.formattedRate).toBe("1\u00a0€ = 0,87\u00a0£");
    });

    it("defaults each amount to its own currency locale", () => {
        const conversion = getPayoutConversion(fixed(10), {
            displayCurrency: "gbp",
            payoutCurrency: "eur",
        });

        expect(conversion?.payoutAmount).toBe("10\u00a0€");
        expect(conversion?.formattedRate).toBe("1\u00a0€ = £0.87");
    });

    it("falls back to the currency locale when the locale tag is malformed", () => {
        const conversion = getPayoutConversion(fixed(10), {
            displayCurrency: "gbp",
            payoutCurrency: "eur",
            locale: "en_US!!",
        });

        expect(conversion?.payoutAmount).toBe("10\u00a0€");
        expect(conversion?.formattedRate).toBe("1\u00a0€ = £0.87");
    });

    it("reports a USD payout shown in the default EUR currency", () => {
        const usdc: TokenAmountType = {
            amount: 20,
            usdAmount: 20,
            eurAmount: 17,
            gbpAmount: 14.8,
        };
        const conversion = getPayoutConversion(
            { payoutType: "fixed", amount: usdc },
            { payoutCurrency: "usd", locale: "en" }
        );

        expect(conversion).toMatchObject({
            displayCurrency: "eur",
            payoutCurrency: "usd",
            rate: 0.85,
            payoutAmount: "$20",
        });
    });

    it("returns undefined when payout and display currency match", () => {
        expect(
            getPayoutConversion(fixed(10), {
                displayCurrency: "eur",
                payoutCurrency: "eur",
            })
        ).toBeUndefined();
        expect(
            getPayoutConversion(fixed(10), { payoutCurrency: "eur" })
        ).toBeUndefined();
    });

    it("treats an unsupported display currency as EUR", () => {
        expect(
            getPayoutConversion(fixed(10), {
                displayCurrency: "jpy" as never,
                payoutCurrency: "eur",
            })
        ).toBeUndefined();
    });

    it("returns undefined for an unknown payout currency", () => {
        expect(
            getPayoutConversion(fixed(10), { displayCurrency: "gbp" })
        ).toBeUndefined();
        expect(
            getPayoutConversion(fixed(10), {
                displayCurrency: "gbp",
                payoutCurrency: "chf" as never,
            })
        ).toBeUndefined();
    });

    it("omits rate and amount when the reward is worth zero", () => {
        expect(
            getPayoutConversion(fixed(0), {
                displayCurrency: "gbp",
                payoutCurrency: "eur",
            })
        ).toEqual({ displayCurrency: "gbp", payoutCurrency: "eur" });
    });

    it("omits the rate when the token was not priced", () => {
        const unpriced: TokenAmountType = {
            amount: 10,
            eurAmount: 10,
            usdAmount: 0,
            gbpAmount: 0,
        };
        const conversion = getPayoutConversion(
            { payoutType: "fixed", amount: unpriced },
            { displayCurrency: "gbp", payoutCurrency: "eur", locale: "en" }
        );

        expect(conversion).toEqual({
            displayCurrency: "gbp",
            payoutCurrency: "eur",
            payoutAmount: "€10",
        });
    });

    it("uses more decimals when the rate is below 0.1", () => {
        const tiny: TokenAmountType = {
            amount: 100,
            eurAmount: 100,
            usdAmount: 0,
            gbpAmount: 6.5,
        };
        const conversion = getPayoutConversion(
            { payoutType: "fixed", amount: tiny },
            { displayCurrency: "gbp", payoutCurrency: "eur", locale: "en" }
        );

        expect(conversion?.formattedRate).toBe("€1 = £0.065");
    });

    it("quotes the richest tier of a tiered reward", () => {
        const conversion = getPayoutConversion(
            {
                payoutType: "tiered",
                tierField: "purchase.amount",
                tiers: [
                    { minValue: 0, maxValue: 100, amount: eure(5) },
                    { minValue: 100, percent: 4 },
                    { minValue: 200, amount: eure(12) },
                ],
            },
            { displayCurrency: "gbp", payoutCurrency: "eur", locale: "en" }
        );

        expect(conversion?.payoutAmount).toBe("€12");
        expect(conversion?.rate).toBeCloseTo(0.87);
    });

    it("has no amount for a percentage reward, and a rate only from its caps", () => {
        const options = {
            displayCurrency: "gbp",
            payoutCurrency: "eur",
        } as const;
        const uncapped = getPayoutConversion(
            {
                payoutType: "percentage",
                percent: 5,
                percentOf: "purchase_amount",
            },
            options
        );
        const capped = getPayoutConversion(
            {
                payoutType: "percentage",
                percent: 5,
                percentOf: "purchase_amount",
                maxAmount: eure(50),
            },
            options
        );

        expect(uncapped).toEqual({
            displayCurrency: "gbp",
            payoutCurrency: "eur",
        });
        expect(capped?.payoutAmount).toBeUndefined();
        expect(capped?.rate).toBeCloseTo(0.87);
    });

    it("has no amount for a tiered reward made only of percent tiers", () => {
        const conversion = getPayoutConversion(
            {
                payoutType: "tiered",
                tierField: "purchase.amount",
                tiers: [{ minValue: 0, percent: 3 }],
            },
            { displayCurrency: "gbp", payoutCurrency: "eur" }
        );

        expect(conversion).toEqual({
            displayCurrency: "gbp",
            payoutCurrency: "eur",
        });
    });
});
