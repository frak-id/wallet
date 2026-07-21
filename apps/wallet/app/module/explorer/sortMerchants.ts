import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import type { ExplorerSort } from "@/module/explorer/stores/explorerSortStore";

/**
 * Client-side sort of the fetched merchant list. Every mode reads a signal the
 * `/explore` payload carries per merchant: `popularity` (trailing-month
 * interactions), `recent`/`expiring` (campaign freshness/soonest end date) and
 * `reward` (best euro reward). "recommended" keeps the backend's own ranking
 * (manual boost + active campaigns), i.e. the order the payload arrives in.
 */
export function sortMerchants(
    merchants: ExplorerMerchantItem[],
    sort: ExplorerSort
): ExplorerMerchantItem[] {
    const sorted = [...merchants];
    switch (sort) {
        case "recommended":
            // Preserve the server-provided ranking as-is.
            return sorted;
        case "popular":
            return sorted.sort((a, b) => b.popularity - a.popularity);
        case "views":
            // Most-viewed cards first (total explorer impressions).
            return sorted.sort((a, b) => b.views - a.views);
        case "recent":
            // Freshest campaign first; merchants with no timestamp sort last.
            return sorted.sort((a, b) => compareDateDesc(a.recent, b.recent));
        case "reward":
            return sorted.sort((a, b) => (b.reward ?? 0) - (a.reward ?? 0));
        case "expiring":
            // Soonest expiry first; open-ended (null) sorts last.
            return sorted.sort((a, b) =>
                compareDateAsc(a.expiring, b.expiring)
            );
    }
}

// Most recent ISO date first; null sorts last.
function compareDateDesc(a: string | null, b: string | null): number {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return Date.parse(b) - Date.parse(a);
}

// Soonest ISO date first; null sorts last.
function compareDateAsc(a: string | null, b: string | null): number {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return Date.parse(a) - Date.parse(b);
}
