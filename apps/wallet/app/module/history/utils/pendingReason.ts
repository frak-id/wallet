import type { RewardHistoryItem } from "@frak-labs/wallet-shared";

/**
 * What a `pending` reward still waits for. Only a purchase reward waits on the
 * brand; any other one waits on its lockup date, or just on the next payout.
 */
export type PendingReason =
    | { kind: "purchase" }
    | { kind: "date"; availableAt: number }
    | { kind: "payout" };

export function pendingReason(
    item: Pick<RewardHistoryItem, "purchase" | "availableAt">,
    now = Date.now()
): PendingReason {
    if (item.purchase) return { kind: "purchase" };
    if (item.availableAt && item.availableAt > now) {
        return { kind: "date", availableAt: item.availableAt };
    }
    return { kind: "payout" };
}
