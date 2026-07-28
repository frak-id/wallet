import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    pauseCampaign,
    resumeCampaign,
} from "@/module/campaigns/api/campaignApi";
import {
    campaignQueryKey,
    campaignsQueryKey,
} from "@/module/campaigns/queries/queryKeys";
import type { Campaign } from "@/types/Campaign";

export function useUpdateCampaignRunningStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["campaign", "running-status"],
        mutationFn: async ({
            merchantId,
            campaignId,
            shouldRun,
        }: {
            merchantId: string;
            campaignId: string;
            shouldRun: boolean;
        }): Promise<Campaign> => {
            if (shouldRun) {
                return resumeCampaign({ merchantId, campaignId });
            }
            return pauseCampaign({ merchantId, campaignId });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: campaignsQueryKey(),
            });
            // Root single-campaign key: prefix-matches both the config
            // (`["campaign", merchantId, id, mode]`) and details
            // (`["campaign", "details", ...]`) caches so the details sheet
            // refetches after a transition.
            await queryClient.invalidateQueries({
                queryKey: campaignQueryKey(),
            });
        },
    });
}
