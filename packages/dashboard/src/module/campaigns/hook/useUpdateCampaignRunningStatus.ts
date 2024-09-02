import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { referralCampaignAbi } from "@frak-labs/shared/context/blockchain/abis/frak-campaign-abis";
import { useMutation } from "@tanstack/react-query";
import { type Address, encodeFunctionData } from "viem";

/**
 * Update the running status of a campaign
 */
export function useUpdateCampaignRunningStatus() {
    const { mutateAsync: sendTx } = useSendTransactionAction();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();

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
            await waitForTxAndInvalidateQueries({
                hash,
                queryKey: ["campaigns"],
            });
        },
    });
}
