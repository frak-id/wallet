import { interactionCampaignAbi } from "@frak-labs/app-essentials";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation } from "@tanstack/react-query";
import { type Address, encodeFunctionData } from "viem";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";

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
        }: {
            campaign: Address;
            newRunningStatus: boolean;
        }) => {
            // Send the transaction to the blockchain
            const { hash } = await sendTx({
                tx: {
                    to: campaign,
                    data: encodeFunctionData({
                        abi: interactionCampaignAbi,
                        functionName: "setRunningStatus",
                        args: [newRunningStatus],
                    }),
                },
                metadata: {
                    header: {
                        title: "Update campaign",
                    },
                    i18n: {
                        fr: {
                            "sdk.modal.sendTransaction.description":
                                "Mettre à jour le statut d'exécution de la campagne",
                        },
                        en: {
                            "sdk.modal.sendTransaction.description":
                                "Update the running status of the campaign",
                        },
                    },
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
