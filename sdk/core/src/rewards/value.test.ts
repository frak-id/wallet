import { describe, expect, it } from "vitest";
import type { EstimatedReward } from "../types";
import { getRewardEurValue, getRewardValue, selectBestReward } from "./value";

const amount = (eur: number) => ({
    amount: eur,
    eurAmount: eur,
    usdAmount: eur,
    gbpAmount: eur,
});

const fixed = (eur: number): EstimatedReward => ({
    payoutType: "fixed",
    amount: amount(eur),
});

describe("getRewardValue", () => {
    it("returns the fixed amount in the requested currency", () => {
        expect(getRewardValue(fixed(5), "eurAmount")).toBe(5);
    });

    it("uses the capped maxAmount for a percentage reward", () => {
        expect(
            getRewardValue(
                {
                    payoutType: "percentage",
                    percent: 8,
                    percentOf: "purchase_amount",
                    maxAmount: amount(4.8),
                },
                "eurAmount"
            )
        ).toBe(4.8);
    });

    it("returns 0 for an uncapped percentage reward", () => {
        expect(
            getRewardValue(
                {
                    payoutType: "percentage",
                    percent: 8,
                    percentOf: "purchase_amount",
                },
                "eurAmount"
            )
        ).toBe(0);
    });

    it("returns the richest token tier for a tiered reward", () => {
        expect(
            getRewardValue(
                {
                    payoutType: "tiered",
                    tierField: "purchase.amount",
                    tiers: [
                        { minValue: 0, maxValue: 50, amount: amount(2) },
                        { minValue: 50, amount: amount(9) },
                    ],
                },
                "eurAmount"
            )
        ).toBe(9);
    });
});

describe("getRewardEurValue", () => {
    it("is the euro-keyed reward value", () => {
        expect(getRewardEurValue(fixed(7))).toBe(7);
    });
});

describe("selectBestReward", () => {
    const campaign = (
        id: string,
        referrer?: EstimatedReward,
        referee?: EstimatedReward
    ) => ({
        interactionTypeKey: "purchase" as const,
        campaignId: id,
        referrer,
        referee,
    });

    it("returns undefined when no candidate has a referrer reward", () => {
        expect(selectBestReward([campaign("a")])).toBeUndefined();
    });

    it("picks the highest-value referrer reward", () => {
        const best = selectBestReward([
            campaign("low", fixed(2)),
            campaign("high", fixed(9)),
        ]);
        expect(best).toEqual(fixed(9));
    });

    it("picks the referee reward when context is 'referred'", () => {
        const best = selectBestReward([campaign("a", fixed(9), fixed(3))], {
            context: "referred",
        });
        expect(best).toEqual(fixed(3));
    });

    it("filters by interaction type before ranking", () => {
        const best = selectBestReward(
            [
                { interactionTypeKey: "referral", referrer: fixed(50) },
                { interactionTypeKey: "purchase", referrer: fixed(4) },
            ],
            { targetInteraction: "purchase" }
        );
        expect(best).toEqual(fixed(4));
    });
});
