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
    test.for([
        ["a purchase reward pays a referrer", reward(), true],
        [
            "no reward has a referrer share",
            reward({ referrer: undefined }),
            false,
        ],
        [
            "the referrer reward is not purchase-triggered",
            reward({ interactionTypeKey: "referral" }),
            false,
        ],
    ] as const)("hasFrakBonusReward when %s", ([, input, expected]) => {
        expect(buildCampaignView([input], "en", now)?.hasFrakBonusReward).toBe(
            expected
        );
    });
});

describe("frakBonusAmount", () => {
    const view = buildCampaignView([reward()], "en", now);
    const signupOnly = buildCampaignView(
        [reward({ interactionTypeKey: "referral" })],
        "en",
        now
    );

    test("returns the formatted referrer estimate when eligible and unshadowed", () => {
        const amount = frakBonusAmount(view, {
            isEligible: true,
            hasMerchantReferrer: false,
        });
        expect(amount).toBeTruthy();
        expect(amount).toBe(view?.headlineReferrerReward);
    });

    test.for([
        ["not eligible", view, false, false],
        ["a merchant-scoped referrer shadows Frak", view, true, true],
        ["no reward pays a referrer on purchase", signupOnly, true, false],
        ["there is no campaign view", null, true, false],
    ] as const)(
        "is undefined when %s",
        ([, input, isEligible, hasMerchantReferrer]) => {
            expect(
                frakBonusAmount(input, { isEligible, hasMerchantReferrer })
            ).toBeUndefined();
        }
    );
});
