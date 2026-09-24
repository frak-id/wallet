import type { MerchantReward } from "@frak-labs/core-sdk";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { buildCampaignView, frakBonusAmount } from "./campaignView";

const now = new Date("2026-01-01T00:00:00.000Z");

function reward(overrides: Partial<MerchantReward> = {}): MerchantReward {
    return {
        campaignId: "c1",
        name: "Campaign",
        interactionTypeKey: "purchase",
        conditions: [],
        referrer: {
            payoutType: "fixed",
            amount: { amount: 5, eurAmount: 5, usdAmount: 5, gbpAmount: 5 },
        },
        ...overrides,
    };
}

describe("buildCampaignView", () => {
    test("hasFrakBonusReward is true when a purchase reward pays a referrer", () => {
        const view = buildCampaignView([reward()], "en", now);
        expect(view?.hasFrakBonusReward).toBe(true);
    });

    test("hasFrakBonusReward is false when no reward has a referrer share", () => {
        const view = buildCampaignView(
            [reward({ referrer: undefined })],
            "en",
            now
        );
        expect(view?.hasFrakBonusReward).toBe(false);
    });

    test("hasFrakBonusReward is false when the referrer reward is not purchase-triggered", () => {
        const view = buildCampaignView(
            [reward({ interactionTypeKey: "referral" })],
            "en",
            now
        );
        expect(view?.hasFrakBonusReward).toBe(false);
    });
});

describe("frakBonusAmount", () => {
    const view = buildCampaignView([reward()], "en", now);

    test("returns the formatted referrer estimate when eligible and unshadowed", () => {
        expect(
            frakBonusAmount(view, {
                isEligible: true,
                hasMerchantReferrer: false,
            })
        ).toBe(view?.headlineReferrerReward);
        expect(
            frakBonusAmount(view, {
                isEligible: true,
                hasMerchantReferrer: false,
            })
        ).toBeTruthy();
    });

    test("is undefined when not eligible", () => {
        expect(
            frakBonusAmount(view, {
                isEligible: false,
                hasMerchantReferrer: false,
            })
        ).toBeUndefined();
    });

    test("is undefined when a merchant-scoped referrer shadows Frak", () => {
        expect(
            frakBonusAmount(view, {
                isEligible: true,
                hasMerchantReferrer: true,
            })
        ).toBeUndefined();
    });

    test("is undefined when no reward pays a referrer on purchase", () => {
        const signupOnly = buildCampaignView(
            [reward({ interactionTypeKey: "referral" })],
            "en",
            now
        );
        expect(
            frakBonusAmount(signupOnly, {
                isEligible: true,
                hasMerchantReferrer: false,
            })
        ).toBeUndefined();
    });

    test("is undefined when there is no campaign view", () => {
        expect(
            frakBonusAmount(null, {
                isEligible: true,
                hasMerchantReferrer: false,
            })
        ).toBeUndefined();
    });
});
