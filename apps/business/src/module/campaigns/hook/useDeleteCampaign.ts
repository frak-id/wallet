import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteCampaign } from "@/module/campaigns/api/campaignApi";
import { campaignsQueryKey } from "@/module/campaigns/queries/queryKeys";

export function useDeleteCampaign() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["campaigns", "delete-campaign"],
        mutationFn: async ({
            merchantId,
            campaignId,
        }: {
            merchantId: string;
            campaignId: string;
        }) => {
            await deleteCampaign({ merchantId, campaignId });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: campaignsQueryKey(),
            });
        },
    });
}
