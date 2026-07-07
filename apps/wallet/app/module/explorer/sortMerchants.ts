import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import type { MerchantRewardSortValue } from "@/module/explorer/explorerRewardSort";
import type { ExplorerSort } from "@/module/explorer/stores/explorerSortStore";

/**
 * Client-side sort of the fetched merchant list. `reward`/`expiring` need
 * `rewardValues` from `estimated-rewards`; without it they keep input order.
 */
export function sortMerchants(
    merchants: ExplorerMerchantItem[],
    sort: ExplorerSort,
    rewardValues?: Map<string, MerchantRewardSortValue>
): ExplorerMerchantItem[] {
    const sorted = [...merchants];
    switch (sort) {
        case "popular":
            return sorted.sort(
                (a, b) => b.activeCampaignCount - a.activeCampaignCount
            );
        case "recent":
            // No timestamp on the payload — reverse as a placeholder.
            return sorted.reverse();
        case "reward":
            return sorted.sort(
                (a, b) =>
                    (rewardValues?.get(b.id)?.rewardValue ?? 0) -
                    (rewardValues?.get(a.id)?.rewardValue ?? 0)
            );
        case "expiring":
            return sorted.sort((a, b) =>
                compareExpiry(
                    rewardValues?.get(a.id)?.soonestExpiry ?? null,
                    rewardValues?.get(b.id)?.soonestExpiry ?? null
                )
            );
    }
}

// Soonest expiry first; open-ended (null) sorts last.
function compareExpiry(a: number | null, b: number | null): number {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
}
