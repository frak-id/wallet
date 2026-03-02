import { useSendTransactionAction } from "@frak-labs/react-sdk";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type Address, encodeFunctionData, erc20Abi } from "viem";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";
import { legacyCampaignBankAbi } from "@/module/merchant/utils/legacyBanks";

type MigrateLegacyBankParams = {
    oldBankAddress: Address;
    newBankAddress: Address;
    token: Address;
    withdrawable: bigint;
    isDistributionEnabled: boolean;
};

export function useMigrateLegacyBank({ merchantId }: { merchantId: string }) {
    const isDemoMode = useIsDemoMode();
    const queryClient = useQueryClient();
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();
    const { mutateAsync: sendTx } = useSendTransactionAction();

    return useMutation({
        mutationKey: ["legacy-bank", "migrate", merchantId],
        mutationFn: async ({
            oldBankAddress,
            newBankAddress,
            token,
            withdrawable,
            isDistributionEnabled,
        }: MigrateLegacyBankParams) => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 300));
                await queryClient.invalidateQueries({
                    queryKey: ["merchant", merchantId, "bank"],
                });
                return;
            }

            const txs: { to: Address; data: `0x${string}` }[] = [];

            if (isDistributionEnabled) {
                txs.push({
                    to: oldBankAddress,
                    data: encodeFunctionData({
                        abi: legacyCampaignBankAbi,
                        functionName: "updateDistributionState",
                        args: [false],
                    }),
                });
            }

            txs.push({
                to: oldBankAddress,
                data: encodeFunctionData({
                    abi: legacyCampaignBankAbi,
                    functionName: "withdraw",
                }),
            });

            txs.push({
                to: token,
                data: encodeFunctionData({
                    abi: erc20Abi,
                    functionName: "transfer",
                    args: [newBankAddress, withdrawable],
                }),
            });

            const { hash } = await sendTx({
                tx: txs,
                metadata: {
                    header: {
                        title: "Migrate legacy bank",
                    },
                    i18n: {
                        fr: {
                            "sdk.modal.sendTransaction.description":
                                "Migrer les fonds de l'ancienne banque vers la nouvelle",
                        },
                        en: {
                            "sdk.modal.sendTransaction.description":
                                "Migrate funds from legacy bank to new bank",
                        },
                    },
                },
            });

            await waitForTxAndInvalidateQueries({
                hash,
                queryKey: ["merchant", merchantId, "bank"],
            });

            await queryClient.invalidateQueries({
                queryKey: ["legacy-bank"],
                exact: false,
            });
        },
    });
}
