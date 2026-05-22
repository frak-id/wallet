import { useSuspenseQuery } from "@tanstack/react-query";
import { campaignsListQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import type { CampaignWithActions } from "@/types/Campaign";

/**
 * Hook used to fetch all the campaigns for the active merchant.
 */
export function useGetCampaigns(): {
    data: CampaignWithActions[];
    isLoading: boolean;
    isError: boolean;
} {
    const isDemoMode = useIsDemoMode();
    const merchantId = useActiveMerchantId();
    return useSuspenseQuery(
        campaignsListQueryOptions({ merchantId, isDemoMode })
    );
}
