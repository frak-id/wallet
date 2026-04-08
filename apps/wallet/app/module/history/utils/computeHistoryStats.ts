import type { HistoryGroup, RewardHistoryItem } from "@frak-labs/wallet-shared";

type HistoryStats = {
    /** Number of referral-type interactions (shared links + referrals) */
    totalShares: number;
    /** Number of purchase-type interactions */
    totalPurchases: number;
    /** Total EUR earnings across all items */
    totalEarningsEur: number;
};

/**
 * Compute aggregate stats from a list of reward history items
 */
export function computeHistoryStats(items: RewardHistoryItem[]): HistoryStats {
    let totalShares = 0;
    let totalPurchases = 0;
    let totalEarningsEur = 0;

    for (const item of items) {
        totalEarningsEur += item.amount.eurAmount;

        if (
            item.trigger === "referral" ||
            item.trigger === "create_referral_link"
        ) {
            totalShares++;
        } else if (item.trigger === "purchase") {
            totalPurchases++;
        }
    }

    return { totalShares, totalPurchases, totalEarningsEur };
}

/**
 * Compute per-day EUR totals from a grouped history
 */
export function computeDayTotals<T extends { amount: { eurAmount: number } }>(
    group: HistoryGroup<T>
): Record<string, number> {
    const totals: Record<string, number> = {};

    for (const [day, items] of Object.entries(group)) {
        totals[day] = items.reduce(
            (sum, item) => sum + item.amount.eurAmount,
            0
        );
    }

    return totals;
}
