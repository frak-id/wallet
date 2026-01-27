import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteCampaign } from "@/context/campaigns/action/deleteCampaign";

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
            await deleteCampaign({ data: { merchantId, campaignId } });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["campaigns"],
            });
        },
    });
}
