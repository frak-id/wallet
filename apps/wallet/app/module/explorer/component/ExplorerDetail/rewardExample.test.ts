import type { EstimatedReward } from "@frak-labs/core-sdk";
import { describe, expect, it } from "vitest";
import {
    buildPercentageExample,
    buildTierExample,
    pickFlatBasket,
    pickTierBasket,
} from "./rewardExample";

type PercentageReward = Extract<EstimatedReward, { payoutType: "percentage" }>;

function percentage(
    percent: number,
    bounds?: { min?: number; max?: number }
): PercentageReward {
    const toAmount = (eur: number) => ({
        amount: eur,
        eurAmount: eur,
        usdAmount: eur,
        gbpAmount: eur,
    });
    return {
        payoutType: "percentage",
        percent,
        percentOf: "purchase_amount",
        minAmount: bounds?.min != null ? toAmount(bounds.min) : undefined,
        maxAmount: bounds?.max != null ? toAmount(bounds.max) : undefined,
    };
}

describe("pickFlatBasket", () => {
    it("defaults to the reference basket of 100", () => {
        expect(pickFlatBasket(undefined)).toBe(100);
        expect(pickFlatBasket(40)).toBe(100);
    });

    it("uses the minimum purchase when it exceeds the reference", () => {
        expect(pickFlatBasket(150)).toBe(150);
    });
});

describe("pickTierBasket", () => {
    it("uses the reference when it fits the tier range", () => {
        expect(pickTierBasket(80, 200)).toBe(100);
    });

    it("uses the lower bound for an open-ended tier", () => {
        expect(pickTierBasket(80, undefined)).toBe(80);
    });

    it("picks a round number inside a bounded tier excluding the reference", () => {
        expect(pickTierBasket(0, 30)).toBe(20);
        expect(pickTierBasket(30, 80)).toBe(60);
    });
});

describe("buildPercentageExample", () => {
    it("computes percent of the basket", () => {
        const example = buildPercentageExample(percentage(8), undefined);
        expect(example?.basket).toBe(100);
        expect(example?.reward).toBeCloseTo(8);
    });

    it("clamps the reward to the configured max amount", () => {
        const example = buildPercentageExample(
            percentage(8, { max: 4.8 }),
            undefined
        );
        expect(example?.basket).toBe(100);
        expect(example?.reward).toBeCloseTo(4.8);
    });

    it("uses the minimum purchase as the basket when higher", () => {
        const example = buildPercentageExample(percentage(5), 200);
        expect(example?.basket).toBe(200);
        expect(example?.reward).toBeCloseTo(10);
    });
});

describe("buildTierExample", () => {
    it("computes percent of the open tier lower bound", () => {
        const example = buildTierExample(12, 80, undefined);
        expect(example?.basket).toBe(80);
        expect(example?.reward).toBeCloseTo(9.6);
    });

    it("computes percent of a round basket inside a bounded tier", () => {
        const example = buildTierExample(5, 30, 80);
        expect(example?.basket).toBe(60);
        expect(example?.reward).toBeCloseTo(3);
    });
});
