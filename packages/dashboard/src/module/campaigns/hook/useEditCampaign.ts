import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { referralCampaignAbi } from "@frak-labs/app-essentials";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { useMutation } from "@tanstack/react-query";
import { type Address, encodeFunctionData, parseEther } from "viem";

/**
 * Update the running status of a campaign
 */
export function useEditCampaign() {
    const { mutateAsync: sendTx } = useSendTransactionAction();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();

    return useMutation({
        mutationKey: ["campaign", "edit"],
        mutationFn: async ({
            campaign,
            period,
            amount,
        }: { campaign: Address; period: number; amount: number }) => {
            // Send the transaction to the blockchain
            const { hash } = await sendTx({
                tx: {
                    to: campaign,
                    data: encodeFunctionData({
                        abi: referralCampaignAbi,
                        functionName: "updateCapConfig",
                        args: [
                            { period, amount: parseEther(amount.toString()) },
                        ],
                    }),
                },
                metadata: {
                    header: {
                        title: "Edit campaign",
                    },
                    context: "Edit budget and date of the campaign",
                },
            });

            // Wait for transaction confirmation
            await waitForTxAndInvalidateQueries({
                hash,
                queryKey: ["campaigns"],
            });
        },
    });
}
