import { referralCampaignAbi } from "@frak-labs/app-essentials";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation } from "@tanstack/react-query";
import { type Address, encodeFunctionData, type Hex, parseUnits } from "viem";
import { readContract } from "viem/actions";
import { viemClient } from "@/context/blockchain/provider";
import { getBankTokenInfo } from "@/context/campaigns/action/getBankInfo";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";

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
                // Get the campaign bank
                const [, , bank] = await readContract(viemClient, {
                    abi: referralCampaignAbi,
                    address: campaign,
                    functionName: "getConfig",
                });
                const { decimals } = await getBankTokenInfo({ bank });

                callDatas.push(
                    encodeFunctionData({
                        abi: referralCampaignAbi,
                        functionName: "updateCapConfig",
                        args: [
                            {
                                period: capConfig.period,
                                amount: parseUnits(
                                    capConfig.amount.toString(),
                                    decimals
                                ),
                            },
                        ],
                    })
                );
            }

            // Add the activation period update
            if (activationPeriod?.start) {
                const start = Math.floor(
                    new Date(activationPeriod.start).getTime() / 1000
                );
                const end = activationPeriod.end
                    ? Math.floor(new Date(activationPeriod.end).getTime()) /
                      1000
                    : 0;
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
                    i18n: {
                        fr: {
                            "sdk.modal.sendTransaction.description":
                                "Modifier le budget et la date de la campagne",
                        },
                        en: {
                            "sdk.modal.sendTransaction.description":
                                "Edit budget and date of the campaign",
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
