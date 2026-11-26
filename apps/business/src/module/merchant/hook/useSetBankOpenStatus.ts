import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Address, encodeFunctionData } from "viem";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { merchantBankQueryKey } from "@/module/merchant/queries/queryKeys";
import { walletPromptMetadata } from "@/module/merchant/utils/walletPromptMetadata";

export function useSetBankOpenStatus({
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

    const {
        mutate: setOpenStatus,
        isPending: isSettingOpenStatus,
        isError: isOpenStatusError,
    } = useMutation({
        mutationKey: ["merchant", merchantId, "bank", "setOpen"],
        mutationFn: async ({ isOpen }: { isOpen: boolean }) => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 300));
                await queryClient.invalidateQueries({
                    queryKey: merchantBankQueryKey(merchantId),
                });
                return;
            }

            const { hash } = await sendTx({
                tx: {
                    to: bankAddress,
                    data: encodeFunctionData({
                        abi: campaignBankAbi,
                        functionName: "setOpen",
                        args: [isOpen],
                    }),
                },
                metadata: await walletPromptMetadata(
                    isOpen
                        ? {
                              titleKey:
                                  "funding.walletPrompt.payRewardsOn.title",
                              descriptionKey:
                                  "funding.walletPrompt.payRewardsOn.description",
                          }
                        : {
                              titleKey:
                                  "funding.walletPrompt.payRewardsOff.title",
                              descriptionKey:
                                  "funding.walletPrompt.payRewardsOff.description",
                          }
                ),
            });

            await waitForTxAndInvalidateQueries({
                hash,
                queryKey: merchantBankQueryKey(merchantId),
            });
        },
    });

    return { setOpenStatus, isSettingOpenStatus, isOpenStatusError };
}
