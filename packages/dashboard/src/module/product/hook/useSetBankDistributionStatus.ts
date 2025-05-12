import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation } from "@tanstack/react-query";
import { type Address, type Hex, encodeFunctionData } from "viem";

/**
 * Hook to toggle the distribution status of a bank
 * @param productId
 * @param bank
 */
export function useSetBankDistributionStatus({
    productId,
    bank,
}: { productId: Hex; bank: Address }) {
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();
    const { mutateAsync: sendTx } = useSendTransactionAction();

    const {
        mutate: setDistributionStatus,
        isPending: isSettingDistributionStatus,
    } = useMutation({
        mutationKey: ["product", "funding", productId, "toggle", bank],
        mutationFn: async ({ isDistributing }: { isDistributing: boolean }) => {
            // Toggle the distribution state
            const { hash } = await sendTx({
                tx: {
                    to: bank,
                    data: encodeFunctionData({
                        abi: campaignBankAbi,
                        functionName: "updateDistributionState",
                        args: [isDistributing],
                    }),
                },
                metadata: {
                    header: {
                        title: "Toggle distribution state",
                    },
                    i18n: {
                        fr: {
                            "sdk.modal.sendTransaction.description": `Basculer le statut de distribution de la banque ${bank}`,
                        },
                        en: {
                            "sdk.modal.sendTransaction.description": `Toggle distribution state of bank ${bank}`,
                        },
                    },
                },
            });

            // Invalidate product related queries
            //  this also reset the top level `useGetProductFunding` query
            await waitForTxAndInvalidateQueries({
                hash,
                queryKey: ["product"],
            });
        },
    });

    return {
        setDistributionStatus,
        isSettingDistributionStatus,
    };
}
