import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    pauseCampaign,
    resumeCampaign,
} from "@/context/campaigns/action/statusTransitions";
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
                return await resumeCampaign({
                    data: { merchantId, campaignId },
                });
            }
            return await pauseCampaign({
                data: { merchantId, campaignId },
            });
        },
        onSuccess: async (_data, { campaignId }) => {
            await queryClient.invalidateQueries({
                queryKey: ["campaigns"],
            });
            await queryClient.invalidateQueries({
                queryKey: ["campaign", campaignId],
            });
        },
    });
}
