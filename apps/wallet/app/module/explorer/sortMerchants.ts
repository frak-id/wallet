import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import type { ExplorerSort } from "@/module/explorer/stores/explorerSortStore";

/**
 * Client-side sort applied to the fetched merchant list.
 *
 * TODO(backend): the `/explore` endpoint only accepts `limit`/`offset` today,
 * so sorting is mocked here until the backend exposes a `sort` query param and
 * enriches each item with reward/expiry/recency data. Once wired, drop this
 * helper and pass `sort` straight through to the query. Only "popular" has a
 * real signal on the current payload (`activeCampaignCount`); the other modes
 * fall back to a stable ordering so the UI stays functional.
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
            // No `createdAt` on the payload yet — reverse the backend order as
            // a placeholder for "most recent" until the field lands.
            return sorted.reverse();
        case "reward":
        case "expiring":
            // Reward amount and expiry date live behind per-merchant campaign
            // queries, not the list payload — needs backend support to sort.
            return sorted;
    }
}
