import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Address, encodeFunctionData } from "viem";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { merchantBankQueryKey } from "@/module/merchant/queries/queryKeys";
import { walletPromptMetadata } from "@/module/merchant/utils/walletPromptMetadata";

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
                    queryKey: merchantBankQueryKey(merchantId),
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
                    metadata: await walletPromptMetadata({
                        titleKey: "funding.walletPrompt.revokeLimit.title",
                        descriptionKey:
                            "funding.walletPrompt.revokeLimit.description",
                    }),
                });

                await waitForTxAndInvalidateQueries({
                    hash,
                    queryKey: merchantBankQueryKey(merchantId),
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
                    metadata: await walletPromptMetadata({
                        titleKey: "funding.walletPrompt.updateLimit.title",
                        descriptionKey:
                            "funding.walletPrompt.updateLimit.description",
                    }),
                });

                await waitForTxAndInvalidateQueries({
                    hash,
                    queryKey: merchantBankQueryKey(merchantId),
                });
            }
        },
    });
}
