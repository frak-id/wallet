import { describe, expect, it } from "vitest";
import type { Currency, EstimatedReward, TokenAmountType } from "../types";
import goldenRewards from "./fixtures/golden-rewards.json";
import {
    getRewardRank,
    getRewardValue,
    isMatchedItemsBasis,
    maxRewardPercent,
} from "./value";

type RewardValueFixture = {
    name: string;
    description: string;
    kind: "reward-value";
    reward: EstimatedReward;
    currency: Currency | null;
    amountKey: keyof TokenAmountType;
    value: number;
    maxPercent: number;
    rank: number;
};

// The JSON import is inferred as a union of per-entry literal shapes, which
// narrows to `never` under a type predicate. Widen ONCE to the declared
// fixture type so the payload fields stay genuinely type-checked and a corpus
// shape drift is a type error rather than a silent pass.
const valueFixtures = (
    goldenRewards.fixtures as unknown as RewardValueFixture[]
).filter(
    (fixture): fixture is RewardValueFixture => fixture.kind === "reward-value"
);

describe("reward value golden fixtures", () => {
    it("declares the expected format version", () => {
        expect(goldenRewards.formatVersion).toBe(1);
    });

    it("pins the percentage-only rank weight, not just its sign", () => {
        const uncapped = valueFixtures.find(
            (fixture) => fixture.name === "value-percentage-uncapped"
        );
        expect(uncapped?.value).toBe(0);
        expect(uncapped?.rank).toBe(8e-6);
    });

    it.each(valueFixtures)(
        "reproduces value / maxPercent / rank for: $description",
        (fixture) => {
            expect(getRewardValue(fixture.reward, fixture.amountKey)).toBe(
                fixture.value
            );
            expect(maxRewardPercent(fixture.reward)).toBe(fixture.maxPercent);
            expect(getRewardRank(fixture.reward, fixture.amountKey)).toBe(
                fixture.rank
            );
        }
    );
});

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

const cappedPercentage = (percent: number, cap: number): EstimatedReward => ({
    payoutType: "percentage",
    percent,
    percentOf: "purchase_amount",
    maxAmount: amount(cap),
});

const uncappedPercentage = (percent: number): EstimatedReward => ({
    payoutType: "percentage",
    percent,
    percentOf: "purchase_amount",
});

describe("getRewardValue", () => {
    it("returns the fixed amount in the requested currency", () => {
        expect(getRewardValue(fixed(5), "eurAmount")).toBe(5);
    });

    it("uses the capped maxAmount for a percentage reward", () => {
        expect(getRewardValue(cappedPercentage(8, 4.8), "eurAmount")).toBe(4.8);
    });

    it("returns 0 for an uncapped percentage reward", () => {
        expect(getRewardValue(uncappedPercentage(8), "eurAmount")).toBe(0);
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

describe("getRewardRank", () => {
    it("ranks a reward with real money by its money value", () => {
        expect(getRewardRank(fixed(5), "eurAmount")).toBe(5);
        expect(getRewardRank(cappedPercentage(8, 4.8), "eurAmount")).toBe(4.8);
    });

    it("gives an uncapped percentage a positive weight (never buried at 0)", () => {
        expect(
            getRewardRank(uncappedPercentage(8), "eurAmount")
        ).toBeGreaterThan(0);
    });

    it("keeps real money ranked above any uncapped percentage", () => {
        expect(getRewardRank(fixed(1), "eurAmount")).toBeGreaterThan(
            getRewardRank(uncappedPercentage(50), "eurAmount")
        );
    });

    it("keeps an uncapped percentage ranked above a zero-value reward", () => {
        expect(
            getRewardRank(uncappedPercentage(8), "eurAmount")
        ).toBeGreaterThan(getRewardRank(fixed(0), "eurAmount"));
    });

    it("ranks a higher uncapped percentage above a lower one", () => {
        expect(
            getRewardRank(uncappedPercentage(20), "eurAmount")
        ).toBeGreaterThan(getRewardRank(uncappedPercentage(5), "eurAmount"));
    });
});

describe("isMatchedItemsBasis", () => {
    it("is false for a fixed reward", () => {
        expect(isMatchedItemsBasis(fixed(5))).toBe(false);
    });

    it("is false for a percentage of the whole purchase", () => {
        expect(
            isMatchedItemsBasis({
                payoutType: "percentage",
                percent: 10,
                percentOf: "purchase_amount",
            })
        ).toBe(false);
    });

    it("is true for a percentage of the matched line items", () => {
        expect(
            isMatchedItemsBasis({
                payoutType: "percentage",
                percent: 10,
                percentOf: "matched_items_amount",
            })
        ).toBe(true);
    });

    it("is false for a tiered reward keyed on a non-matched field", () => {
        expect(
            isMatchedItemsBasis({
                payoutType: "tiered",
                tierField: "purchase.amount",
                tiers: [],
            })
        ).toBe(false);
    });

    it("is true for a tiered reward keyed on the matched amount or quantity", () => {
        expect(
            isMatchedItemsBasis({
                payoutType: "tiered",
                tierField: "purchase.matchedAmount",
                tiers: [],
            })
        ).toBe(true);
        expect(
            isMatchedItemsBasis({
                payoutType: "tiered",
                tierField: "purchase.matchedQuantity",
                tiers: [],
            })
        ).toBe(true);
    });
});
