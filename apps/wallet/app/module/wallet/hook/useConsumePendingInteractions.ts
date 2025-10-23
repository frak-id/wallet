import { pushBackupData } from "@frak-labs/wallet-shared/sdk/utils/backup";
import {
    selectPendingInteractionsArray,
    walletStore,
} from "@frak-labs/wallet-shared/stores/walletStore";
import { interactionsKey } from "@frak-labs/wallet-shared/wallet/queryKeys/interactions";
import { useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { authenticatedWalletApi } from "@/module/common/api/backendClient";
import { useGetSafeSdkSession } from "@/module/common/hook/useGetSafeSdkSession";

/**
 * Hook used to consume the pending interactions
 */
export function useConsumePendingInteractions() {
    const interactions = walletStore(selectPendingInteractionsArray);
    const { address } = useAccount();
    const { sdkSession, getSdkSession } = useGetSafeSdkSession();

    return useMutation({
        mutationKey: interactionsKey.consumePending,
        mutationFn: async () => {
            // If no wallet address, return
            if (!address) {
                return;
            }

            // If no interactions, return
            if (!interactions.length) {
                return;
            }

            // Fetch the token that will be used to push the interaction
            const safeSdkSession = sdkSession ?? (await getSdkSession()).data;
            if (!safeSdkSession) {
                return;
            }

            // Submit the interactions
            const { data } =
                await authenticatedWalletApi.interactions.push.post({
                    interactions: interactions.map((interaction) => ({
                        wallet: address,
                        productId: interaction.productId,
                        interaction: interaction.interaction,
                        signature: interaction.signature,
                    })),
                });

            // Clean the pending interactions
            if (data) {
                walletStore.getState().cleanPendingInteractions();
                await pushBackupData();
            }

            return {
                delegationId: data ?? [],
                submittedInteractions: interactions.length,
            };
        },
    });
}
