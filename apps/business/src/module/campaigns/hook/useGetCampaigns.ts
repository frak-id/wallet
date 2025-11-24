import { useSuspenseQuery } from "@tanstack/react-query";
import { campaignsListQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";

/**
 * Hook used to fetch all the campaigns for the current user
 */
export const useGetCampaigns = () => {
    const isDemoMode = useIsDemoMode();
    return useSuspenseQuery(campaignsListQueryOptions(isDemoMode));
};
