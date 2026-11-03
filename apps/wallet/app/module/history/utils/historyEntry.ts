import type { MoneriumOrderDto } from "@backend-domain/monerium/schemas";
import type { RewardHistoryItem } from "@frak-labs/wallet-shared";

/**
 * Unified history entry rendered in both the wallet home preview and the
 * full `/history` page. Discriminated by `kind` so the row component can
 * dispatch on shape without `instanceof` checks.
 *
 * `timestamp` is normalised to **seconds since epoch** (matches the
 * `groupByDay` convention which multiplies by 1000 internally).
 */
export type HistoryEntry =
    | {
          kind: "reward";
          /** Stable React key: the reward's own id. */
          id: string;
          /** Seconds since epoch. */
          timestamp: number;
          reward: RewardHistoryItem;
      }
    | {
          kind: "monerium-order";
          id: string;
          timestamp: number;
          order: MoneriumOrderDto;
      };

/**
 * `RewardHistoryItem.createdAt` is normalised to **milliseconds** by
 * `useGetRewardHistory`. Convert to seconds here so the resulting entry is
 * directly consumable by `groupByDay`.
 */
export function rewardToHistoryEntry(reward: RewardHistoryItem): HistoryEntry {
    return {
        kind: "reward",
        id: reward.id,
        timestamp: Math.floor(reward.createdAt / 1000),
        reward,
    };
}

/**
 * Order timestamp priority: `processedAt` (if set) > `placedAt`. The
 * processed timestamp is the closest analogue to a reward's "settled"
 * moment, which is what the user actually cares about when scanning a
 * dated history.
 *
 * Falls back to `Date.now()` if both are missing/invalid — Monerium
 * guarantees `placedAt` in the schema, so this is purely defensive.
 */
export function orderToHistoryEntry(order: MoneriumOrderDto): HistoryEntry {
    const sourceIso = order.processedAt ?? order.placedAt;
    const parsed = sourceIso ? Date.parse(sourceIso) : Number.NaN;
    const ms = Number.isFinite(parsed) ? parsed : Date.now();

    return {
        kind: "monerium-order",
        id: order.id,
        timestamp: Math.floor(ms / 1000),
        order,
    };
}

/**
 * Merge rewards and orders into a single, timestamp-descending list. The
 * caller is responsible for ensuring inputs are already normalised (i.e.
 * rewards must have `createdAt` in ms — which `useGetRewardHistory` does).
 */
export function mergeHistoryEntries(
    rewards: RewardHistoryItem[],
    orders: MoneriumOrderDto[]
): HistoryEntry[] {
    const entries: HistoryEntry[] = [
        ...rewards.map(rewardToHistoryEntry),
        ...orders.map(orderToHistoryEntry),
    ];
    return entries.sort((a, b) => b.timestamp - a.timestamp);
}
