import { describe, expect, test } from "../../../tests/vitest-fixtures";
import { selectFormattedReward } from "./useFormattedEstimatedReward";

describe("selectFormattedReward product context", () => {
    const fixed = (amount: number) => ({
        payoutType: "fixed" as const,
        amount: {
            amount,
            eurAmount: amount,
            usdAmount: amount,
            gbpAmount: amount,
        },
    });

    // A richer campaign scoped to a product we're not showing, and a poorer
    // one scoped to the product we are.
    const rewards = [
        {
            campaignId: "rich-elsewhere",
            name: "Rich, other product",
            conditions: [],
            interactionTypeKey: "purchase",
            referrer: fixed(50),
            productScope: [{ field: "sku", operator: "eq", value: "HAT-1" }],
        },
        {
            campaignId: "poor-here",
            name: "Poorer, this product",
            conditions: [],
            interactionTypeKey: "purchase",
            referrer: fixed(5),
            productScope: [{ field: "sku", operator: "eq", value: "SHOE-42" }],
        },
    ] as never;

    test("advertises the campaign that applies to the shown product", () => {
        const selected = selectFormattedReward({
            products: [{ sku: "SHOE-42" }],
        })(rewards);

        expect(selected?.formatted).toMatch(/^5\s€$/);
        expect(selected?.matchedProducts).toEqual([{ sku: "SHOE-42" }]);
    });

    test("keeps the unscoped ranking when no product context is given", () => {
        expect(selectFormattedReward({})(rewards)?.formatted).toMatch(
            /^50\s€$/
        );
    });
});
