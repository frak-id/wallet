import { describe, expect, it } from "vitest";
import type {
    EstimatedReward,
    MerchantReward,
    SubscriptionRewards,
} from "../types";
import { selectBestReward } from "./select";
import {
    formatSubscriptionReward,
    getLeadingReward,
    getSubscriptionRank,
} from "./subscription";

const fixed = (eur: number): EstimatedReward => ({
    payoutType: "fixed",
    amount: { amount: eur, eurAmount: eur, usdAmount: eur, gbpAmount: eur },
});

const percentage = (percent: number): EstimatedReward => ({
    payoutType: "percentage",
    percent,
    percentOf: "purchase_amount",
});

const subscription = (
    first: EstimatedReward | undefined,
    renewal: EstimatedReward | undefined,
    renewals = 4
): SubscriptionRewards => ({
    steps: [
        ...(first ? [{ from: 1, to: 1, referrer: first }] : []),
        ...(renewal && renewals > 0
            ? [{ from: 2, to: 1 + renewals, referrer: renewal }]
            : []),
    ],
});

const campaign = (
    id: string,
    plan: SubscriptionRewards | undefined,
    referrer?: EstimatedReward
): MerchantReward => ({
    campaignId: id,
    name: id,
    interactionTypeKey: "purchase",
    conditions: [],
    referrer:
        plan?.steps.find((range) => range.from === 1)?.referrer ?? referrer,
    subscription: plan,
});

describe("formatSubscriptionReward", () => {
    it("adds up a fixed plan: first payment plus every renewal", () => {
        const result = formatSubscriptionReward(
            subscription(fixed(10), fixed(5)),
            "referrer",
            "eur"
        );

        expect(result?.formatted).toMatch(/^30\u00a0€$/);
        expect(result?.parts).toMatchObject({ integer: "30", unit: "€" });
    });

    it("reads a share of each payment as a percentage per payment", () => {
        const result = formatSubscriptionReward(
            subscription(percentage(20), percentage(10)),
            "referrer",
            "eur"
        );

        expect(result).toMatchObject({ formatted: "20 %", upTo: true });
        expect(result?.parts).toMatchObject({ integer: "20", unit: "%" });
    });

    it("totals the money when a fixed range is mixed with a percentage", () => {
        const result = formatSubscriptionReward(
            subscription(fixed(10), percentage(5)),
            "referrer",
            "eur"
        );

        expect(result?.formatted).toMatch(/^10\u00a0€$/);
    });

    it("counts a capped percentage at its cap in the money total", () => {
        const capped: EstimatedReward = {
            payoutType: "percentage",
            percent: 5,
            percentOf: "purchase_amount",
            maxAmount: {
                amount: 3,
                eurAmount: 3,
                usdAmount: 3,
                gbpAmount: 3,
            },
        };
        const result = formatSubscriptionReward(
            subscription(fixed(10), capped, 2),
            "referrer",
            "eur"
        );

        expect(result?.formatted).toMatch(/^16\u00a0€$/);
    });

    it("has nothing to show for an uncapped percentage plan that is not per cycle", () => {
        expect(
            formatSubscriptionReward(
                {
                    ...subscription(percentage(10), percentage(5)),
                    stepBy: "amount",
                },
                "referrer",
                "eur"
            )
        ).toBeUndefined();
    });

    it("keeps the percentage form for a cycle-based plan", () => {
        const result = formatSubscriptionReward(
            { ...subscription(percentage(10), percentage(5)), stepBy: "cycle" },
            "referrer",
            "eur"
        );

        expect(result?.formatted).toBe("10 %");
    });

    it("totals the money of an amount-based plan", () => {
        const result = formatSubscriptionReward(
            { ...subscription(fixed(10), fixed(5)), stepBy: "amount" },
            "referrer",
            "eur"
        );

        expect(result?.formatted).toMatch(/^30\u00a0€$/);
    });

    it("rounds the total once instead of each step", () => {
        const result = formatSubscriptionReward(
            { steps: [{ from: 1, to: 12, referrer: fixed(2.5) }] },
            "referrer",
            "eur"
        );

        expect(result?.formatted).toMatch(/^30\u00a0€$/);
    });

    it("multiplies each range's reward by its number of steps", () => {
        const result = formatSubscriptionReward(
            {
                steps: [
                    { from: 1, to: 1, referrer: fixed(10) },
                    { from: 2, to: 3, referrer: fixed(5) },
                    { from: 4, to: 12, referrer: fixed(2) },
                ],
            },
            "referrer",
            "eur"
        );

        expect(result?.formatted).toMatch(/^38\u00a0€$/);
    });

    it("counts only the first payment when there are no renewals", () => {
        const result = formatSubscriptionReward(
            subscription(fixed(10), fixed(5), 0),
            "referrer",
            "eur"
        );

        expect(result?.formatted).toMatch(/^10\u00a0€$/);
    });

    it("has nothing to show for an audience without a reward", () => {
        expect(
            formatSubscriptionReward(
                subscription(fixed(10), fixed(5)),
                "referee",
                "eur"
            )
        ).toBeUndefined();
    });
});

describe("subscription ranking", () => {
    it("ranks a plan by its whole value", () => {
        expect(
            getSubscriptionRank(
                subscription(fixed(10), fixed(5)),
                "referrer",
                "eurAmount"
            )
        ).toBe(30);
    });

    it("leads with the first payment, else the first renewal", () => {
        expect(
            getLeadingReward(subscription(fixed(10), fixed(5)), "referrer")
        ).toEqual(fixed(10));
        expect(
            getLeadingReward(subscription(undefined, fixed(5)), "referrer")
        ).toEqual(fixed(5));
    });
});

describe("selectBestReward on a subscription campaign", () => {
    it("formats the plan and keeps the first payment's payout type", () => {
        const best = selectBestReward(
            [campaign("sub", subscription(fixed(10), fixed(5)))],
            { currency: "eur" }
        );

        expect(best?.formatted).toMatch(/^30\u00a0€$/);
        expect(best?.upTo).toBe(true);
        expect(best?.payoutType).toBe("fixed");
    });

    it("prefers the plan worth more over a bigger one-shot reward", () => {
        const best = selectBestReward(
            [
                campaign("one-shot", undefined, fixed(20)),
                campaign("sub", subscription(fixed(10), fixed(5))),
            ],
            { currency: "eur" }
        );

        expect(best?.formatted).toMatch(/^30\u00a0€$/);
    });

    it("leaves a regular campaign's output untouched", () => {
        const best = selectBestReward(
            [campaign("one-shot", undefined, fixed(12))],
            { currency: "eur" }
        );

        expect(best?.formatted).toMatch(/^12\u00a0€$/);
        expect(best?.upTo).toBeUndefined();
    });
});
