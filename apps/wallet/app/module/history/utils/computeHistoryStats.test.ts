import type { RewardHistoryItem } from "@frak-labs/wallet-shared";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { computeHistoryStats } from "./computeHistoryStats";

function makeReward(
    overrides: Partial<RewardHistoryItem> = {}
): RewardHistoryItem {
    return {
        merchant: { name: "Frak", domain: "frak.id" },
        token: { symbol: "USDC", decimals: 6 },
        amount: { amount: 1, eurAmount: 1, usdAmount: 1, gbpAmount: 1 },
        status: "pending",
        role: "referee",
        trigger: "purchase",
        createdAt: 1_700_000_000_000,
        ...overrides,
    } as RewardHistoryItem;
}

describe("computeHistoryStats", () => {
    test("counts a welcome-bonus row as a purchase, not a share", () => {
        const stats = computeHistoryStats([
            makeReward({ role: "welcome_bonus", trigger: "purchase" }),
        ]);

        expect(stats.totalPurchases).toBe(1);
        expect(stats.totalShares).toBe(0);
    });

    test("sums the welcome-bonus amount into total earnings", () => {
        const stats = computeHistoryStats([
            makeReward({
                role: "welcome_bonus",
                amount: { amount: 5, eurAmount: 5, usdAmount: 5, gbpAmount: 5 },
            }),
        ]);

        expect(stats.totalEarningsEur).toBe(5);
    });
});
