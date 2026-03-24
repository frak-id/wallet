import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Address, encodeFunctionData } from "viem";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";

type BankAllowanceMutationParams = {
    merchantId: string;
    bankAddress: Address;
    action: "revoke" | "update";
};

type RevokeMutationInput = {
    token: Address;
};

type UpdateMutationInput = {
    token: Address;
    amount: bigint;
};

type MutationInput = RevokeMutationInput | UpdateMutationInput;

export function useBankAllowanceMutation({
    merchantId,
    bankAddress,
    action,
}: BankAllowanceMutationParams) {
    const isDemoMode = useIsDemoMode();
    const queryClient = useQueryClient();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();
    const { mutateAsync: sendTx } = useSendTransactionAction();

    return useMutation({
        mutationKey: [
            "merchant",
            merchantId,
            "bank",
            action === "revoke" ? "revokeAllowance" : "updateAllowance",
        ],
        mutationFn: async (input: MutationInput) => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 300));
                await queryClient.invalidateQueries({
                    queryKey: ["merchant", merchantId, "bank"],
                });
                return;
            }

            if (action === "revoke") {
                const { token } = input as RevokeMutationInput;
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
            } else {
                const { token, amount } = input as UpdateMutationInput;
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
            }
        },
    });
}
