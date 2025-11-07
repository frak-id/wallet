"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyCampaigns } from "@/context/campaigns/action/getCampaigns";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";

/**
 * Hook used to fetch all the campaigns for the current user
 */
export const useGetCampaigns = () => {
    const isDemoMode = useIsDemoMode();

    return useQuery({
        queryKey: ["campaigns", "my-campaigns", isDemoMode ? "demo" : "live"],
        queryFn: async () => await getMyCampaigns(),
    });
};
