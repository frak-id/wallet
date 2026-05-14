import type { RewardHistoryItem } from "@frak-labs/wallet-shared";
import {
    mergeHistoryEntries,
    orderToHistoryEntry,
    rewardToHistoryEntry,
} from "@/module/history/utils/historyEntry";
import type { MoneriumOrder } from "@/module/monerium/utils/moneriumTypes";
import { describe, expect, test } from "@/tests/vitest-fixtures";

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

function makeOrder(overrides: Partial<MoneriumOrder> = {}): MoneriumOrder {
    return {
        id: "ord-1",
        profile: "prof-1",
        address: "0xabc",
        kind: "redeem",
        chain: "arbitrum",
        amount: "10.00",
        currency: "eur",
        counterpart: {
            identifier: { standard: "iban", iban: "EE52" },
            details: {},
        },
        memo: "",
        meta: { placedAt: "2024-01-01T10:00:00Z" },
        state: "pending",
        ...overrides,
    } as MoneriumOrder;
}

describe("historyEntry adapters", () => {
    describe("rewardToHistoryEntry", () => {
        test("converts ms timestamp to seconds", () => {
            const entry = rewardToHistoryEntry(makeReward({ createdAt: 5000 }));
            expect(entry.kind).toBe("reward");
            expect(entry.timestamp).toBe(5);
        });

        test("uses txHash as id when present", () => {
            const entry = rewardToHistoryEntry(
                makeReward({ txHash: "0xdead" })
            );
            expect(entry.id).toBe("0xdead");
        });

        test("falls back to createdAt+domain when no txHash", () => {
            const entry = rewardToHistoryEntry(makeReward());
            expect(entry.id).toContain("frak.id");
        });
    });

    describe("orderToHistoryEntry", () => {
        test("prefers processedAt over placedAt for timestamp", () => {
            const entry = orderToHistoryEntry(
                makeOrder({
                    meta: {
                        placedAt: "2024-01-01T10:00:00Z",
                        processedAt: "2024-01-01T12:00:00Z",
                    },
                })
            );
            expect(entry.timestamp).toBe(
                Math.floor(Date.parse("2024-01-01T12:00:00Z") / 1000)
            );
        });

        test("falls back to placedAt when no processedAt", () => {
            const entry = orderToHistoryEntry(makeOrder());
            expect(entry.timestamp).toBe(
                Math.floor(Date.parse("2024-01-01T10:00:00Z") / 1000)
            );
        });

        test("uses order id as entry id", () => {
            const entry = orderToHistoryEntry(makeOrder({ id: "ord-42" }));
            expect(entry.id).toBe("ord-42");
            expect(entry.kind).toBe("monerium-order");
        });
    });

    describe("mergeHistoryEntries", () => {
        test("sorts entries by timestamp descending", () => {
            // RewardHistoryItem.createdAt is **ms** since epoch — use a real
            // recent timestamp so it doesn't accidentally rank lower than
            // an order with an RFC 3339 ISO timestamp (which is also ms-scale).
            const older = makeReward({
                createdAt: Date.parse("2024-06-01T00:00:00Z"),
            });
            const newer = makeReward({
                createdAt: Date.parse("2024-07-01T00:00:00Z"),
                txHash: "0xnew",
            });
            const olderOrder = makeOrder({
                id: "ord-old",
                meta: { placedAt: "2020-01-01T00:00:00Z" },
            });

            const merged = mergeHistoryEntries([older, newer], [olderOrder]);

            expect(merged[0].id).toBe("0xnew");
            expect(merged[merged.length - 1].id).toBe("ord-old");
        });

        test("handles empty inputs gracefully", () => {
            expect(mergeHistoryEntries([], [])).toEqual([]);
        });

        test("produces a discriminated union the consumer can switch on", () => {
            const merged = mergeHistoryEntries(
                [makeReward({ txHash: "0xr1" })],
                [makeOrder({ id: "ord-1" })]
            );
            const kinds = merged.map((e) => e.kind).sort();
            expect(kinds).toEqual(["monerium-order", "reward"]);
        });
    });
});
