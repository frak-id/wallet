import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import type { ExplorerSort } from "@/module/explorer/stores/explorerSortStore";

/**
 * Client-side sort applied to the fetched merchant list.
 *
 * Only "popular" has a real signal on the current payload
 * (`activeCampaignCount`); the other modes fall back to a stable ordering so
 * the UI stays functional.
 */
export function sortMerchants(
    merchants: ExplorerMerchantItem[],
    sort: ExplorerSort
): ExplorerMerchantItem[] {
    const sorted = [...merchants];
    switch (sort) {
        case "popular":
            return sorted.sort(
                (a, b) => b.activeCampaignCount - a.activeCampaignCount
            );
        case "recent":
            // No `createdAt` on the payload — reverse the fetched order as a
            // placeholder for "most recent".
            return sorted.reverse();
        case "reward":
        case "expiring":
            // Reward amount and expiry date aren't on the list payload, so
            // these keep the current order.
            return sorted;
    }
}
