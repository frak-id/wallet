import type {
    MerchantReward,
    RuleCondition,
    RuleConditions,
} from "@frak-labs/core-sdk";
import { formatAmount } from "@frak-labs/core-sdk";
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
    test("formats the headline reward in the campaign payout currency", () => {
        const priced = {
            payoutType: "fixed" as const,
            amount: {
                amount: 10,
                eurAmount: 10,
                usdAmount: 17,
                gbpAmount: 8.7,
            },
        };
        const view = buildCampaignView(
            [reward({ referrer: priced, payoutCurrency: "usd" })],
            "en",
            now
        );

        expect(view?.payoutCurrency).toBe("usd");
        expect(view?.headlineReferrerReward).toContain("17");
    });

    test("falls back to EUR when the payout currency is unknown", () => {
        const priced = {
            payoutType: "fixed" as const,
            amount: {
                amount: 10,
                eurAmount: 10,
                usdAmount: 17,
                gbpAmount: 8.7,
            },
        };
        const view = buildCampaignView(
            [reward({ referrer: priced })],
            "en",
            now
        );

        expect(view?.headlineReferrerReward).toContain("10");
    });

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

    test("welcomeBonus carries the currency of the campaign it comes from", () => {
        const view = buildCampaignView(
            [
                reward({
                    campaignId: "signup",
                    interactionTypeKey: "referral",
                    referrer: fixed(20),
                    payoutCurrency: "eur",
                }),
                reward({
                    campaignId: "purchase",
                    referrer: fixed(3),
                    payoutCurrency: "usd",
                }),
            ],
            "en",
            now
        );
        expect(view?.payoutCurrency).toBe("eur");
        expect(view?.welcomeBonusCurrency).toBe("usd");
    });

    test("minPurchaseDisplay uses the payout currency", () => {
        const view = buildCampaignView(
            [
                reward({
                    payoutCurrency: "usd",
                    conditions: [
                        {
                            field: "purchase.amount",
                            operator: "gte",
                            value: 50,
                        },
                    ],
                }),
            ],
            "en",
            now
        );
        expect(view?.minPurchaseDisplay).toBe(formatAmount(50, "usd"));
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
