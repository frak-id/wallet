"use client";

import { useQuery } from "@tanstack/react-query";
import { getCampaignFunnelMock } from "@/context/campaigns/action/mock";

/**
 * Hook to fetch campaign funnel data
 * @param campaignId - Optional campaign ID. If not provided, returns global aggregated data
 */
export function useGetCampaignFunnel(campaignId?: string) {
    return useQuery({
        queryKey: ["campaigns", "funnel", campaignId ?? "global"],
        queryFn: async () => await getCampaignFunnelMock({ campaignId }),
    });
}
