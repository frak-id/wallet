import { useSuspenseQuery } from "@tanstack/react-query";
import { campaignsListQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import type { CampaignListItemWithActions } from "@/types/Campaign";

export type CampaignWithStats = CampaignListItemWithActions;

/**
 * Fetches the merchant's campaigns (with embedded per-row stats) for the
 * list table. Backed by a single `GET /campaigns` call.
 *
 * Uses `useSuspenseQuery`, so callers must be rendered under a Suspense
 * boundary. `data` is guaranteed non-undefined once the hook returns.
 */
export function useCampaignsWithStats(): {
    data: CampaignWithStats[];
} {
    const isDemoMode = useIsDemoMode();
    const merchantId = useActiveMerchantId();

    const { data } = useSuspenseQuery(
        campaignsListQueryOptions({ merchantId, isDemoMode })
    );

    return { data: data.campaigns };
}
