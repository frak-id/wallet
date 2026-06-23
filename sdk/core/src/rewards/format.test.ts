import { describe, expect, it } from "vitest";
import type { EstimatedReward } from "../types";
import { applyRewardPlaceholder, formatEstimatedReward } from "./format";

const amount = (eur: number) => ({
    amount: eur,
    eurAmount: eur,
    usdAmount: eur,
    gbpAmount: eur,
});

describe("formatEstimatedReward", () => {
    it("formats a fixed reward in the default currency, rounded", () => {
        const reward: EstimatedReward = {
            payoutType: "fixed",
            amount: amount(5.4),
        };
        // Intl renders a narrow no-break space before "€" — assert content.
        const formatted = formatEstimatedReward(reward);
        expect(formatted).toContain("5");
        expect(formatted).not.toContain("6");
        expect(formatted).toContain("€");
    });

    it("renders a percentage reward as a percent string (never a basket amount)", () => {
        const reward: EstimatedReward = {
            payoutType: "percentage",
            percent: 10,
            percentOf: "purchase_amount",
            maxAmount: amount(50),
        };
        expect(formatEstimatedReward(reward)).toBe("10 %");
    });

    it("uses the richest token tier for a tiered reward", () => {
        const reward: EstimatedReward = {
            payoutType: "tiered",
            tierField: "purchase.amount",
            tiers: [
                { minValue: 0, maxValue: 50, amount: amount(2) },
                { minValue: 50, amount: amount(8) },
            ],
        };
        const formatted = formatEstimatedReward(reward);
        expect(formatted).toContain("8");
        expect(formatted).toContain("€");
    });

    it("falls back to the max percent when tiers carry no token amount", () => {
        const reward: EstimatedReward = {
            payoutType: "tiered",
            tierField: "purchase.amount",
            tiers: [
                { minValue: 0, maxValue: 50, percent: 5 },
                { minValue: 50, percent: 12 },
            ],
        };
        expect(formatEstimatedReward(reward)).toBe("12 %");
    });

    it("respects the requested currency", () => {
        const reward: EstimatedReward = {
            payoutType: "fixed",
            amount: amount(5),
        };
        const formatted = formatEstimatedReward(reward, "usd");
        expect(formatted).toContain("5");
        expect(formatted).toContain("$");
    });
});

describe("applyRewardPlaceholder", () => {
    it("substitutes the reward into the placeholder", () => {
        expect(applyRewardPlaceholder("Earn {REWARD} now", "5 €")).toBe(
            "Earn 5 € now"
        );
    });

    it("strips the placeholder when no reward is provided", () => {
        expect(applyRewardPlaceholder("Earn {REWARD} now", undefined)).toBe(
            "Earn  now"
        );
    });
});
