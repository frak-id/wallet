import type { RewardHistoryItem } from "@frak-labs/wallet-shared";
import {
    mergeHistoryEntries,
    orderToHistoryEntry,
    rewardToHistoryEntry,
} from "@/module/history/utils/historyEntry";
import { moneriumOrder } from "@/tests/moneriumFixtures";
import { describe, expect, test } from "@/tests/vitest-fixtures";

function makeReward(
    overrides: Partial<RewardHistoryItem> = {}
): RewardHistoryItem {
    return {
        id: "asset-1",
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

describe("historyEntry adapters", () => {
    describe("rewardToHistoryEntry", () => {
        test("converts ms timestamp to seconds", () => {
            const entry = rewardToHistoryEntry(makeReward({ createdAt: 5000 }));
            expect(entry.kind).toBe("reward");
            expect(entry.timestamp).toBe(5);
        });

        test("keys two rewards settled in the same transaction apart", () => {
            const [first, second] = ["asset-1", "asset-2"].map((id) =>
                rewardToHistoryEntry(makeReward({ id, txHash: "0xbatch" }))
            );
            expect(first?.id).toBe("asset-1");
            expect(second?.id).toBe("asset-2");
        });
    });

    describe("orderToHistoryEntry", () => {
        test("prefers processedAt over placedAt for timestamp", () => {
            const entry = orderToHistoryEntry(
                moneriumOrder({
                    placedAt: "2024-01-01T10:00:00Z",
                    processedAt: "2024-01-01T12:00:00Z",
                })
            );
            expect(entry.timestamp).toBe(
                Math.floor(Date.parse("2024-01-01T12:00:00Z") / 1000)
            );
        });

        test("falls back to placedAt when no processedAt", () => {
            const entry = orderToHistoryEntry(moneriumOrder());
            expect(entry.timestamp).toBe(
                Math.floor(Date.parse("2024-01-01T10:00:00Z") / 1000)
            );
        });

        test("uses order id as entry id", () => {
            const entry = orderToHistoryEntry(moneriumOrder({ id: "ord-42" }));
            expect(entry.id).toBe("ord-42");
            expect(entry.kind).toBe("monerium-order");
        });
    });

    describe("mergeHistoryEntries", () => {
        test("sorts entries by timestamp descending", () => {
            const older = makeReward({
                createdAt: Date.parse("2024-06-01T00:00:00Z"),
            });
            const newer = makeReward({
                id: "asset-new",
                createdAt: Date.parse("2024-07-01T00:00:00Z"),
            });
            const olderOrder = moneriumOrder({
                id: "ord-old",
                placedAt: "2020-01-01T00:00:00Z",
            });

            const merged = mergeHistoryEntries([older, newer], [olderOrder]);

            expect(merged[0].id).toBe("asset-new");
            expect(merged[merged.length - 1].id).toBe("ord-old");
        });

        test("handles empty inputs gracefully", () => {
            expect(mergeHistoryEntries([], [])).toEqual([]);
        });

        test("produces a discriminated union the consumer can switch on", () => {
            const merged = mergeHistoryEntries(
                [makeReward({ txHash: "0xr1" })],
                [moneriumOrder({ id: "ord-1" })]
            );
            const kinds = merged.map((e) => e.kind).sort();
            expect(kinds).toEqual(["monerium-order", "reward"]);
        });
    });
});
