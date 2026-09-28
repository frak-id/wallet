import type {
    MerchantReward,
    RuleCondition,
    RuleConditions,
} from "@frak-labs/core-sdk";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { buildCampaignView } from "./campaignView";

const now = new Date("2026-01-01T00:00:00.000Z");

const referralCondition: RuleCondition = {
    field: "attribution.referrerIdentityGroupId",
    operator: "exists",
    value: true,
};

function fixed(amount: number) {
    return {
        payoutType: "fixed" as const,
        amount: {
            amount,
            eurAmount: amount,
            usdAmount: amount,
            gbpAmount: amount,
        },
    };
}

function reward(overrides: Partial<MerchantReward> = {}): MerchantReward {
    return {
        campaignId: "c1",
        name: "Campaign",
        interactionTypeKey: "purchase",
        conditions: [],
        referrer: fixed(5),
        ...overrides,
    };
}

describe("buildCampaignView", () => {
    test.for<[string, RuleConditions, boolean]>([
        ["a flat list requires a referrer", [referralCondition], true],
        [
            "an `all` group requires a referrer",
            { logic: "all", conditions: [referralCondition] },
            true,
        ],
        [
            "an `any` group only offers the referrer as one option",
            { logic: "any", conditions: [referralCondition] },
            false,
        ],
        ["there are no conditions", [], false],
    ])("isReferralOnly when %s", ([, conditions, expected]) => {
        const view = buildCampaignView([reward({ conditions })], "en", now);
        expect(view?.isReferralOnly).toBe(expected);
    });

    test("welcomeBonus is the displayed purchase campaign's referrer share", () => {
        const view = buildCampaignView([reward()], "en", now);
        expect(view?.welcomeBonus).toEqual(fixed(5));
    });

    test("welcomeBonus falls back to a purchase campaign when a signup one is displayed", () => {
        const view = buildCampaignView(
            [
                reward({
                    campaignId: "signup",
                    interactionTypeKey: "referral",
                    referrer: fixed(20),
                }),
                reward({ campaignId: "purchase", referrer: fixed(3) }),
            ],
            "en",
            now
        );
        expect(view?.referrer).toEqual(fixed(20));
        expect(view?.welcomeBonus).toEqual(fixed(3));
    });

    test("welcomeBonus is undefined without a purchase campaign", () => {
        const view = buildCampaignView(
            [reward({ interactionTypeKey: "referral" })],
            "en",
            now
        );
        expect(view?.welcomeBonus).toBeUndefined();
    });
});
