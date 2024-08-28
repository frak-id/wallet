import { viemClient } from "@/context/blockchain/provider";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { referralCampaignAbi } from "@frak-labs/shared/context/blockchain/abis/frak-campaign-abis";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { guard } from "radash";
import { type Address, encodeFunctionData } from "viem";
import { waitForTransactionReceipt } from "viem/actions";

/**
 * Update the running status of a campaign
 */
export function useUpdateCampaignRunningStatus() {
    const { mutateAsync: sendTx } = useSendTransactionAction();
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["campaign", "pause"],
        mutationFn: async ({
            campaign,
            newRunningStatus,
        }: { campaign: Address; newRunningStatus: boolean }) => {
            // Send the transaction to the blockchain
            const { hash } = await sendTx({
                tx: {
                    to: campaign,
                    data: encodeFunctionData({
                        abi: referralCampaignAbi,
                        functionName: "setRunningStatus",
                        args: [newRunningStatus],
                    }),
                },
                metadata: {
                    header: {
                        title: "Update campaign",
                    },
                    context: "Update the running status of the campaign",
                },
            });

            // Wait for transaction confirmation
            await guard(() =>
                waitForTransactionReceipt(viemClient, {
                    hash,
                    confirmations: 8,
                    retryCount: 32,
                })
            );

            // Invalidate my campaigns query
            await queryClient.invalidateQueries({
                queryKey: ["campaigns", "my-campaigns"],
            });
        },
    });
}
