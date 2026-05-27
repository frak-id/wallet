import { useSuspenseQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import type { CampaignStats } from "@/module/campaigns/api/campaignStatsApi";
import {
    campaignsListQueryOptions,
    campaignsStatsQueryOptions,
} from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import type { CampaignWithActions } from "@/types/Campaign";

export type CampaignWithStats = CampaignWithActions & {
    stats?: CampaignStats;
};

/**
 * Fetches the merchant's campaigns and joins each row with its stats so the
 * list table can render conversion / revenue columns without re-querying.
 *
 * Uses `useSuspenseQueries`, so callers must be rendered under a Suspense
 * boundary. `data` is guaranteed non-undefined once the hook returns.
 */
export function useCampaignsWithStats(): {
    data: CampaignWithStats[];
} {
    const isDemoMode = useIsDemoMode();
    const merchantId = useActiveMerchantId();

    const [campaignsQuery, statsQuery] = useSuspenseQueries({
        queries: [
            campaignsListQueryOptions({ merchantId, isDemoMode }),
            campaignsStatsQueryOptions({ merchantId, isDemoMode }),
        ],
    });

    const data = useMemo<CampaignWithStats[]>(() => {
        const statsById = new Map<string, CampaignStats>(
            (statsQuery.data ?? []).map((s) => [s.campaignId, s])
        );
        return (campaignsQuery.data ?? []).map((campaign) => ({
            ...campaign,
            stats: statsById.get(campaign.id),
        }));
    }, [campaignsQuery.data, statsQuery.data]);

    return { data };
}
