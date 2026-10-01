import type {
    EstimatedReward,
    MerchantReward,
    TokenAmountType,
} from "@frak-labs/core-sdk";
import { formatAmount } from "@frak-labs/core-sdk";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { buildCampaignView } from "./campaignView";
import { buildRewardOffer } from "./rewardOffer";

const now = new Date("2026-01-01T00:00:00.000Z");
const referralOnly = [
    {
        field: "attribution.referrerIdentityGroupId",
        operator: "exists",
        value: true,
    },
] as const;

function money(amount: number): TokenAmountType {
    return {
        amount,
        eurAmount: amount,
        usdAmount: amount,
        gbpAmount: amount,
    };
}

function fixed(amount: number): EstimatedReward {
    return { payoutType: "fixed", amount: money(amount) };
}

const tenPercent: EstimatedReward = {
    payoutType: "percentage",
    percent: 10,
    percentOf: "purchase_amount",
};

function view(overrides: Partial<MerchantReward> = {}) {
    return buildCampaignView(
        [
            {
                campaignId: "c1",
                name: "Campaign",
                interactionTypeKey: "purchase",
                conditions: [...referralOnly],
                referrer: fixed(5),
                referee: fixed(4),
                ...overrides,
            },
        ],
        "en",
        now
    );
}

const someone = { code: "ABCDEF" };
const noReferrer = {
    crossMerchantReferrer: null,
    merchantReferrer: null,
    frakReferral: null,
};
const frak = {
    crossMerchantReferrer: someone,
    merchantReferrer: null,
    frakReferral: { claimedMerchantIds: [] },
};

describe("buildRewardOffer", () => {
    test("is empty without a campaign", () => {
        expect(buildRewardOffer(null, frak, "m1")).toEqual({});
    });

    test("always carries the per-referral amount", () => {
        expect(buildRewardOffer(view(), noReferrer, "m1").share).toEqual({
            amount: formatAmount(5),
        });
    });

    test.for([
        ["the user has no referrer", noReferrer],
        ["the referral status is not loaded", undefined],
    ] as const)(
        "offers nothing on purchase of a referral-only campaign when %s",
        ([, status]) => {
            expect(
                buildRewardOffer(view(), status, "m1").purchase
            ).toBeUndefined();
        }
    );

    test("offers cashback to anyone when the campaign is not referral-only", () => {
        const offer = buildRewardOffer(
            view({ conditions: [] }),
            noReferrer,
            "m1"
        );
        expect(offer.purchase).toEqual({
            cashback: fixed(4),
            welcomeBonus: undefined,
            total: fixed(4),
            amount: formatAmount(4),
        });
    });

    test("offers cashback, without bonus, to a user referred by someone else", () => {
        const offer = buildRewardOffer(
            view(),
            { ...noReferrer, crossMerchantReferrer: someone },
            "m1"
        );
        expect(offer.purchase?.cashback).toEqual(fixed(4));
        expect(offer.purchase?.welcomeBonus).toBeUndefined();
    });

    test("adds the Frak welcome bonus and sums it into the first-purchase amount", () => {
        const offer = buildRewardOffer(view(), frak, "m1");
        expect(offer.purchase).toEqual({
            cashback: fixed(4),
            welcomeBonus: fixed(5),
            total: fixed(9),
            amount: formatAmount(9),
        });
    });

    test("sums two percentages into one", () => {
        const offer = buildRewardOffer(
            view({
                referee: tenPercent,
                referrer: { ...tenPercent, percent: 5 },
            }),
            frak,
            "m1"
        );
        expect(offer.purchase?.amount).toBe("15 %");
    });

    test("keeps the tiers when adding the bonus to tiered cashback", () => {
        const offer = buildRewardOffer(
            view({
                referee: {
                    payoutType: "tiered",
                    tierField: "purchase.amount",
                    tiers: [
                        { minValue: 0, maxValue: 50, amount: money(2) },
                        { minValue: 50, amount: money(6) },
                    ],
                },
            }),
            frak,
            "m1"
        );
        expect(offer.purchase?.total).toEqual({
            payoutType: "tiered",
            tierField: "purchase.amount",
            tiers: [
                { minValue: 0, maxValue: 50, amount: money(7) },
                { minValue: 50, amount: money(11) },
            ],
        });
        expect(offer.purchase?.amount).toBe(formatAmount(11));
    });

    test("spells out both parts when they can't be summed", () => {
        const offer = buildRewardOffer(
            view({ referee: tenPercent }),
            frak,
            "m1"
        );
        expect(offer.purchase?.total).toBeUndefined();
        expect(offer.purchase?.amount).toBe(`10 % + ${formatAmount(5)}`);
    });

    test("headlines the bonus alone when the campaign has no referee reward", () => {
        const offer = buildRewardOffer(
            view({ referee: undefined }),
            frak,
            "m1"
        );
        expect(offer.purchase).toEqual({
            cashback: undefined,
            welcomeBonus: fixed(5),
            total: fixed(5),
            amount: formatAmount(5),
        });
    });

    test.for([
        [
            "the bonus is already claimed here",
            { ...frak, frakReferral: { claimedMerchantIds: ["m1"] } },
        ],
        [
            "a friend's link shadows Frak here",
            { ...frak, merchantReferrer: someone },
        ],
    ] as const)("drops the bonus but keeps cashback when %s", ([, status]) => {
        const offer = buildRewardOffer(view(), status, "m1");
        expect(offer.purchase?.welcomeBonus).toBeUndefined();
        expect(offer.purchase?.amount).toBe(formatAmount(4));
    });
});
