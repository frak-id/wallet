import type {
    EstimatedReward,
    RewardTier,
    TokenAmountType,
} from "@frak-labs/core-sdk";

type Fixed = Extract<EstimatedReward, { payoutType: "fixed" }>;
type Percentage = Extract<EstimatedReward, { payoutType: "percentage" }>;
type Tiered = Extract<EstimatedReward, { payoutType: "tiered" }>;

// A percent tier pays a share of its `tierField` value (backend RewardCalculator).
const TIER_FIELD_BY_PERCENT_OF: Record<string, string> = {
    purchase_amount: "purchase.amount",
    matched_items_amount: "purchase.matchedAmount",
};

function addAmounts(a: TokenAmountType, b: TokenAmountType): TokenAmountType {
    return {
        amount: a.amount + b.amount,
        eurAmount: a.eurAmount + b.eurAmount,
        usdAmount: a.usdAmount + b.usdAmount,
        gbpAmount: a.gbpAmount + b.gbpAmount,
    };
}

function addPercentages(a: Percentage, b: Percentage): Percentage | undefined {
    if (a.percentOf !== b.percentOf) return undefined;
    const floors = [a.minAmount, b.minAmount].filter((m) => m != null);
    return {
        payoutType: "percentage",
        percent: a.percent + b.percent,
        percentOf: a.percentOf,
        // Either side uncapped leaves the total uncapped.
        maxAmount:
            a.maxAmount && b.maxAmount
                ? addAmounts(a.maxAmount, b.maxAmount)
                : undefined,
        minAmount: floors.length > 0 ? floors.reduce(addAmounts) : undefined,
    };
}

type TierPayout = { amount: TokenAmountType } | { percent: number };

function addToTier(
    tier: RewardTier,
    payout: TierPayout
): RewardTier | undefined {
    if ("amount" in tier && "amount" in payout) {
        return { ...tier, amount: addAmounts(tier.amount, payout.amount) };
    }
    if ("percent" in tier && "percent" in payout) {
        return { ...tier, percent: tier.percent + payout.percent };
    }
    return undefined;
}

function addFlatToTiered(
    tiered: Tiered,
    flat: Fixed | Percentage
): Tiered | undefined {
    if (flat.payoutType === "percentage") {
        const capped = flat.maxAmount != null || flat.minAmount != null;
        if (
            capped ||
            TIER_FIELD_BY_PERCENT_OF[flat.percentOf] !== tiered.tierField
        ) {
            return undefined;
        }
    }
    const payout: TierPayout =
        flat.payoutType === "fixed"
            ? { amount: flat.amount }
            : { percent: flat.percent };
    const tiers = tiered.tiers.map((tier) => addToTier(tier, payout));
    if (tiers.some((tier) => tier == null)) return undefined;
    return { ...tiered, tiers: tiers as RewardTier[] };
}

function sameBracket(a: RewardTier, b: RewardTier): boolean {
    return a.minValue === b.minValue && a.maxValue === b.maxValue;
}

function addTiered(a: Tiered, b: Tiered): Tiered | undefined {
    if (a.tierField !== b.tierField || a.tiers.length !== b.tiers.length) {
        return undefined;
    }
    const byMin = (x: RewardTier, y: RewardTier) => x.minValue - y.minValue;
    const tiersA = [...a.tiers].sort(byMin);
    const tiersB = [...b.tiers].sort(byMin);
    const tiers: RewardTier[] = [];
    for (const [index, tierA] of tiersA.entries()) {
        const tierB = tiersB[index];
        if (!sameBracket(tierA, tierB)) return undefined;
        const sum = addToTier(tierA, tierB);
        if (!sum) return undefined;
        tiers.push(sum);
    }
    return { ...a, tiers };
}

/**
 * The reward paying `a` and `b` together, or `undefined` when no single
 * reward shape states the sum exactly (fixed + percentage, mixed bases, …).
 */
export function addRewards(
    a: EstimatedReward,
    b: EstimatedReward
): EstimatedReward | undefined {
    if (a.payoutType === "tiered" && b.payoutType === "tiered") {
        return addTiered(a, b);
    }
    if (a.payoutType === "tiered" && b.payoutType !== "tiered") {
        return addFlatToTiered(a, b);
    }
    if (b.payoutType === "tiered" && a.payoutType !== "tiered") {
        return addFlatToTiered(b, a);
    }
    if (a.payoutType === "fixed" && b.payoutType === "fixed") {
        return { payoutType: "fixed", amount: addAmounts(a.amount, b.amount) };
    }
    if (a.payoutType === "percentage" && b.payoutType === "percentage") {
        return addPercentages(a, b);
    }
    return undefined;
}
