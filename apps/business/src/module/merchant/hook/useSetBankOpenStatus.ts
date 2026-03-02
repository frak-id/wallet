import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Address, encodeFunctionData } from "viem";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";

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

    const { mutate: setOpenStatus, isPending: isSettingOpenStatus } =
        useMutation({
            mutationKey: ["merchant", merchantId, "bank", "setOpen"],
            mutationFn: async ({ isOpen }: { isOpen: boolean }) => {
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
                            functionName: "setOpen",
                            args: [isOpen],
                        }),
                    },
                    metadata: {
                        header: {
                            title: isOpen ? "Open bank" : "Close bank",
                        },
                        i18n: {
                            fr: {
                                "sdk.modal.sendTransaction.description": isOpen
                                    ? "Ouvrir la banque pour la distribution"
                                    : "Fermer la banque",
                            },
                            en: {
                                "sdk.modal.sendTransaction.description": isOpen
                                    ? "Open bank for distribution"
                                    : "Close bank",
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

    return { setOpenStatus, isSettingOpenStatus };
}
