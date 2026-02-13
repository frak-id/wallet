import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Address, encodeFunctionData } from "viem";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";

export function useWithdrawFromBank({
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
        mutationKey: ["merchant", merchantId, "bank", "withdraw"],
        mutationFn: async ({
            token,
            amount,
            to,
        }: {
            token: Address;
            amount: bigint;
            to: Address;
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
                        functionName: "withdraw",
                        args: [token, amount, to],
                    }),
                },
                metadata: {
                    header: {
                        title: "Withdraw funds",
                    },
                    i18n: {
                        fr: {
                            "sdk.modal.sendTransaction.description":
                                "Retirer les fonds de la banque",
                        },
                        en: {
                            "sdk.modal.sendTransaction.description":
                                "Withdraw funds from the bank",
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
