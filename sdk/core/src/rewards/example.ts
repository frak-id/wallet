import type { EstimatedReward } from "../types";

type PercentageReward = Extract<EstimatedReward, { payoutType: "percentage" }>;

// Reference order total used to turn a "% of basket" reward into a concrete
// example amount. The campaign's minimum purchase overrides it when higher.
const REFERENCE_BASKET = 100;

export type RewardExample = {
    basket: number;
    reward: number;
};

function roundWithinRange(min: number, max: number): number {
    const rounded = Math.round((min + max) / 2 / 10) * 10;
    return Math.min(max, Math.max(min, rounded));
}

export function pickFlatBasket(minPurchase: number | undefined): number {
    return Math.max(REFERENCE_BASKET, minPurchase ?? 0);
}

// Basket for a percentage tier: the reference when it sits inside the tier
// range, a round number within the range otherwise, or the lower bound for an
// open-ended (uncapped) top tier.
export function pickTierBasket(
    minValue: number,
    maxValue: number | undefined
): number {
    if (maxValue == null) return minValue;
    if (minValue <= REFERENCE_BASKET && REFERENCE_BASKET <= maxValue) {
        return REFERENCE_BASKET;
    }
    return roundWithinRange(minValue, maxValue);
}

export function buildPercentageExample(
    reward: PercentageReward,
    minPurchase: number | undefined,
    productPrice?: number
): RewardExample | undefined {
    // A scoped percentage (`percentOf: "matched_items_amount"`) is a percentage
    // of the matched line items, not the whole basket — a basket-based example
    // would be actively wrong for it. When the caller knows the actual product
    // on display (the reward's real basis), use its price instead of the
    // fictional reference basket; the campaign's minimum purchase doesn't apply
    // to a per-product basis, so it's only used for the whole-basket case.
    const basket =
        reward.percentOf === "matched_items_amount" && productPrice != null
            ? productPrice
            : pickFlatBasket(minPurchase);
    if (basket <= 0) return undefined;
    let amount = (reward.percent / 100) * basket;
    if (reward.minAmount) amount = Math.max(amount, reward.minAmount.eurAmount);
    if (reward.maxAmount) amount = Math.min(amount, reward.maxAmount.eurAmount);
    return { basket, reward: amount };
}

export function buildTierExample(
    percent: number,
    minValue: number,
    maxValue: number | undefined
): RewardExample | undefined {
    const basket = pickTierBasket(minValue, maxValue);
    if (basket <= 0) return undefined;
    return { basket, reward: (percent / 100) * basket };
}
