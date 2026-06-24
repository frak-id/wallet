import { describe, expect, it } from "vitest";
import type { EstimatedReward } from "../types";
import { getRewardRank, getRewardValue } from "./value";

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
