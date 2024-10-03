import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { referralCampaignAbi } from "@frak-labs/app-essentials";
import { useSendTransactionAction } from "@frak-labs/nexus-sdk/react";
import { useMutation } from "@tanstack/react-query";
import { type Address, type Hex, encodeFunctionData, parseEther } from "viem";

/**
 * Update the running status of a campaign
 */
export function useEditCampaign() {
    const { mutateAsync: sendTx } = useSendTransactionAction();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();

    return useMutation({
        mutationKey: ["campaigns", "onchain-update"],
        mutationFn: async ({
            campaign,
            capConfig,
            activationPeriod,
        }: {
            campaign: Address;
            capConfig?: { period: number; amount: number };
            activationPeriod?: { start?: Date; end?: Date };
        }) => {
            const callDatas: Hex[] = [];

            // Add the cap config update
            if (capConfig) {
                callDatas.push(
                    encodeFunctionData({
                        abi: referralCampaignAbi,
                        functionName: "updateCapConfig",
                        args: [
                            {
                                period: capConfig.period,
                                amount: parseEther(capConfig.amount.toString()),
                            },
                        ],
                    })
                );
            }

            // Add the activation period update
            if (activationPeriod) {
                const start = (activationPeriod.start?.getTime() ?? 0) / 1000;
                const end = (activationPeriod.end?.getTime() ?? 0) / 1000;
                callDatas.push(
                    encodeFunctionData({
                        abi: referralCampaignAbi,
                        functionName: "updateActivationPeriod",
                        args: [{ start, end }],
                    })
                );
            }

            if (callDatas.length === 0) {
                return;
            }

            // Send the transaction to the blockchain
            const { hash } = await sendTx({
                tx: callDatas.map((data) => ({
                    to: campaign,
                    data,
                })),
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
