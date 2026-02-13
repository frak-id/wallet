import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Address, encodeFunctionData } from "viem";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";

export function useRevokeBankAllowance({
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
        mutationKey: ["merchant", merchantId, "bank", "revokeAllowance"],
        mutationFn: async ({ token }: { token: Address }) => {
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
                        functionName: "revokeAllowance",
                        args: [token],
                    }),
                },
                metadata: {
                    header: {
                        title: "Revoke allowance",
                    },
                    i18n: {
                        fr: {
                            "sdk.modal.sendTransaction.description":
                                "Révoquer l'allocation de distribution",
                        },
                        en: {
                            "sdk.modal.sendTransaction.description":
                                "Revoke distribution allowance",
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
