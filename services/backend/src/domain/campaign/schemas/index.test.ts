import type { MerchantReward } from "@frak-labs/core-sdk";
import { selectBestReward } from "@frak-labs/core-sdk/rewards";
import { getSchemaValidator } from "elysia";
import { describe, expect, it } from "vitest";
import { EstimatedRewardsResultSchema } from "./index";

const validator = getSchemaValidator(EstimatedRewardsResultSchema, {});

// Bun and Node ship different ICU versions, which can disagree on CLDR
// separators — hence the explicit codepoints rather than a pasted literal.
function eurReward(): MerchantReward {
    return {
        campaignId: "campaign-1",
        name: "Referral campaign",
        interactionTypeKey: "create_referral_link",
        conditions: [],
        referrer: {
            payoutType: "fixed",
            amount: { amount: 12, eurAmount: 12, usdAmount: 13, gbpAmount: 10 },
        },
    };
}

describe("EstimatedRewardsResultSchema", () => {
    it("accepts a realistic selectBestReward output", () => {
        const best = selectBestReward([eurReward()], { currency: "eur" });
        expect(best).toBeDefined();

        expect(best?.formatted).toBe("12\u00a0€");
        expect(
            [...(best?.formatted ?? "")].map((c) => c.codePointAt(0))
        ).toEqual([0x31, 0x32, 0xa0, 0x20ac]);

        expect(validator?.Check({ rewards: [], best })).toBe(true);
    });

    it("accepts an absent `best` — the 'nothing worth showing' outcome", () => {
        expect(validator?.Check({ rewards: [] })).toBe(true);
    });

    it("rejects a `best` missing the required `formatted` field", () => {
        expect(
            validator?.Check({ rewards: [], best: { payoutType: "fixed" } })
        ).toBe(false);
    });

    it("rejects a `best` with an invalid `payoutType` literal", () => {
        expect(
            validator?.Check({
                rewards: [],
                best: { formatted: "12\u00a0€", payoutType: "unknown" },
            })
        ).toBe(false);
    });

    // Native SDKs decode `matchedProducts` from this response — Elysia strips any field
    // the schema doesn't declare, so a missing entry here silently makes the whole
    // product-scope feature inert on the wire without a single test failing elsewhere.
    it("accepts a scoped `best` carrying `isProductScoped` and `matchedProducts`", () => {
        const best = selectBestReward(
            [
                {
                    campaignId: "campaign-1",
                    name: "Shoe campaign",
                    interactionTypeKey: "purchase",
                    conditions: [],
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                    referrer: {
                        payoutType: "fixed",
                        amount: {
                            amount: 5,
                            eurAmount: 5,
                            usdAmount: 5.5,
                            gbpAmount: 4.5,
                        },
                    },
                },
            ],
            { currency: "eur", products: [{ sku: "SHOE-42" }] }
        );

        expect(best?.isProductScoped).toBe(true);
        expect(best?.matchedProducts).toEqual([{ sku: "SHOE-42" }]);
        expect(validator?.Check({ rewards: [], best })).toBe(true);
    });

    it("rejects a `best` missing the now-required `isProductScoped`", () => {
        expect(
            validator?.Check({
                rewards: [],
                best: { formatted: "12\u00a0€", payoutType: "fixed" },
            })
        ).toBe(false);
    });
});
