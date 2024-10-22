import { deleteCampaign } from "@/context/campaigns/action/deleteCampaign";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const useDeleteCampaign = () => {
    const queryClient = useQueryClient();
    const { mutateAsync: sendTxAsync } = useSendTransactionAction();

    return useMutation({
        mutationKey: ["campaigns", "delete-campaign"],
        mutationFn: async ({ campaignId }: { campaignId: string }) => {
            // Call the delete campaign action
            let result = await deleteCampaign({ campaignId });

            // If it's requiring an on-chain deletion, execute the transaction
            if (result.key === "require-onchain-delete") {
                const { hash } = await sendTxAsync({
                    metadata: {
                        context: `Deleting the campaign ${campaignId}`,
                    },
                    tx: result.tx,
                });
                console.log("Submitted campaign deletion transaction", {
                    hash,
                });
                // Refresh the result
                result = await deleteCampaign({ campaignId });
            }
            console.log(result);

            if (result.key !== "success") {
                console.error("Unable to delete the campaign, aborting");
                throw new Error("Campaign deletion failed");
            }

            // Invalidate the campaigns related cache
            await queryClient.invalidateQueries({
                queryKey: ["campaigns"],
                exact: false,
            });
        },
    });
};
