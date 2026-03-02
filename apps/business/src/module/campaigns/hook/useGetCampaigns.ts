import { useSuspenseQuery } from "@tanstack/react-query";
import { campaignsListQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import type { CampaignWithActions } from "@/types/Campaign";

/**
 * Hook used to fetch all the campaigns for the current user
 */
export function useGetCampaigns(): {
    data: CampaignWithActions[];
    isLoading: boolean;
    isError: boolean;
} {
    const isDemoMode = useIsDemoMode();
    return useSuspenseQuery(campaignsListQueryOptions(isDemoMode));
}
