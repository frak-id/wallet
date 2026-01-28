import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Address, encodeFunctionData } from "viem";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";

export function useUpdateBankAllowance({
    bankAddress,
    merchantId,
}: {
    bankAddress: Address;
    merchantId: string;
}) {
    const isDemoMode = useIsDemoMode();
    const queryClient = useQueryClient();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();
    const { mutateAsync: sendTx } = useSendTransactionAction();

    return useMutation({
        mutationKey: ["merchant", merchantId, "bank", "updateAllowance"],
        mutationFn: async ({
            token,
            amount,
        }: {
            token: Address;
            amount: bigint;
        }) => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 300));
                await queryClient.invalidateQueries({
                    queryKey: ["merchant", merchantId, "bank"],
                });
                return;
            }

            const { hash } = await sendTx({
                tx: {
                    to: bankAddress,
                    data: encodeFunctionData({
                        abi: campaignBankAbi,
                        functionName: "updateAllowance",
                        args: [token, amount],
                    }),
                },
                metadata: {
                    header: {
                        title: "Update allowance",
                    },
                    i18n: {
                        fr: {
                            "sdk.modal.sendTransaction.description":
                                "Mettre à jour l'allocation de distribution",
                        },
                        en: {
                            "sdk.modal.sendTransaction.description":
                                "Update distribution allowance",
                        },
                    },
                },
            });

            await waitForTxAndInvalidateQueries({
                hash,
                queryKey: ["merchant", merchantId, "bank"],
            });
        },
    });
}
