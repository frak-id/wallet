"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyCampaigns } from "@/context/campaigns/action/getCampaigns";

/**
 * Hook used to fetch all the campaigns for the current user
 */
export const useGetCampaigns = () =>
    useQuery({
        queryKey: ["campaigns", "my-campaigns"],
        queryFn: async () => await getMyCampaigns(),
    });
