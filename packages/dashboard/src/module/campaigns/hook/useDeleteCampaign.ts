import { deleteCampaign } from "@/context/campaigns/action/deleteCampaign";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useDeleteCampaign = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["campaigns", "delete-campaign"],
        mutationFn: async ({ campaignId }: { campaignId: string }) => {
            // todo: If calldata present, execute it
            // todo: Maybe two step deletion for deployed campaign? Like on chain delete then off chain delete
            // todo: First call would only return deletion calldata if campaign still attached, second one would perform db deletion?

            // Call the delete campaign action
            await deleteCampaign({ campaignId });

            // Invalidate the campaigns related cache
            await queryClient.invalidateQueries({
                queryKey: ["campaigns"],
                exact: false,
            });
        },
    });
};
