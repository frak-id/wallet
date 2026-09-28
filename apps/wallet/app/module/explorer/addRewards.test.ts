import type { EstimatedReward, TokenAmountType } from "@frak-labs/core-sdk";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { addRewards } from "./addRewards";

function money(value: number): TokenAmountType {
    return {
        amount: value,
        eurAmount: value,
        usdAmount: value,
        gbpAmount: value,
    };
}

function fixed(value: number): EstimatedReward {
    return { payoutType: "fixed", amount: money(value) };
}

function percent(
    value: number,
    extra: Partial<Extract<EstimatedReward, { payoutType: "percentage" }>> = {}
): EstimatedReward {
    return {
        payoutType: "percentage",
        percent: value,
        percentOf: "purchase_amount",
        ...extra,
    };
}

function amountTiers(values: [number, number]): EstimatedReward {
    return {
        payoutType: "tiered",
        tierField: "purchase.amount",
        tiers: [
            { minValue: 0, maxValue: 50, amount: money(values[0]) },
            { minValue: 50, amount: money(values[1]) },
        ],
    };
}

function percentTiers(
    values: [number, number],
    tierField = "purchase.amount"
): EstimatedReward {
    return {
        payoutType: "tiered",
        tierField,
        tiers: [
            { minValue: 0, maxValue: 50, percent: values[0] },
            { minValue: 50, percent: values[1] },
        ],
    };
}

describe("addRewards", () => {
    test("adds two fixed amounts in every currency", () => {
        expect(addRewards(fixed(4), fixed(5))).toEqual(fixed(9));
    });

    test("adds two percentages of the same basis", () => {
        expect(addRewards(percent(5), percent(3))).toEqual(
            percent(8, { maxAmount: undefined, minAmount: undefined })
        );
    });

    test("keeps a cap only when both percentages are capped", () => {
        const capped = percent(5, { maxAmount: money(10) });
        expect(addRewards(capped, percent(3))).toMatchObject({
            maxAmount: undefined,
        });
        expect(
            addRewards(capped, percent(3, { maxAmount: money(4) }))
        ).toMatchObject({ maxAmount: money(14) });
    });

    test("adds a fixed amount to every amount tier, whichever side it is on", () => {
        expect(addRewards(amountTiers([2, 6]), fixed(5))).toEqual(
            amountTiers([7, 11])
        );
        expect(addRewards(fixed(5), amountTiers([2, 6]))).toEqual(
            amountTiers([7, 11])
        );
    });

    test("adds a percentage to percent tiers on the same basis", () => {
        expect(addRewards(percentTiers([2, 4]), percent(5))).toEqual(
            percentTiers([7, 9])
        );
    });

    test("adds two tiered rewards bracket by bracket, in any tier order", () => {
        const reversed = amountTiers([1, 3]);
        if (reversed.payoutType !== "tiered") throw new Error("fixture");
        reversed.tiers.reverse();
        expect(addRewards(amountTiers([2, 6]), reversed)).toEqual(
            amountTiers([3, 9])
        );
    });

    test.for<[string, EstimatedReward, EstimatedReward]>([
        ["a fixed amount and a percentage", fixed(5), percent(5)],
        [
            "percentages of different bases",
            percent(5),
            percent(5, { percentOf: "matched_items_amount" }),
        ],
        ["a percentage and amount tiers", percent(5), amountTiers([2, 6])],
        ["a fixed amount and percent tiers", fixed(5), percentTiers([2, 4])],
        [
            "a percentage and tiers on another basis",
            percent(5),
            percentTiers([2, 4], "purchase.matchedAmount"),
        ],
        [
            "a capped percentage and percent tiers",
            percent(5, { maxAmount: money(10) }),
            percentTiers([2, 4]),
        ],
        [
            "tiers on different fields",
            percentTiers([2, 4]),
            percentTiers([2, 4], "purchase.matchedAmount"),
        ],
        [
            "tiers with different brackets",
            amountTiers([2, 6]),
            {
                payoutType: "tiered",
                tierField: "purchase.amount",
                tiers: [
                    { minValue: 0, maxValue: 30, amount: money(1) },
                    { minValue: 30, amount: money(2) },
                ],
            },
        ],
    ])("has no exact sum for %s", ([, a, b]) => {
        expect(addRewards(a, b)).toBeUndefined();
    });
});
