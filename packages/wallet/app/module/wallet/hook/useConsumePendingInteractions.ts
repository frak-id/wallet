import { authenticatedBackendApi } from "@/module/common/api/backendClient";
import { useGetSafeSdkSession } from "@/module/common/hook/useGetSafeSdkSession";
import { pushBackupData } from "@/module/sdk/utils/backup";
import {
    cleanPendingInteractionsAtom,
    pendingInteractionAtom,
} from "@/module/wallet/atoms/pendingInteraction";
import { walletInteractionsMutationKeys } from "@/module/wallet/queryKeys/interactions";
import { useMutation } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useAccount } from "wagmi";

/**
 * Hook used to consume the pending interactions
 */
export function useConsumePendingInteractions() {
    const { interactions } = useAtomValue(pendingInteractionAtom);
    const cleanPendingInteractions = useSetAtom(cleanPendingInteractionsAtom);
    const { address } = useAccount();
    const { sdkSession, getSdkSession } = useGetSafeSdkSession();

    return useMutation({
        mutationKey: walletInteractionsMutationKeys.consumePending,
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
                await authenticatedBackendApi.interactions.push.post({
                    interactions: interactions.map((interaction) => ({
                        wallet: address,
                        productId: interaction.productId,
                        interaction: interaction.interaction,
                        signature: interaction.signature,
                    })),
                });

            // Clean the pending interactions
            if (data) {
                cleanPendingInteractions();
                await pushBackupData();
            }

            return {
                delegationId: data ?? [],
                submittedInteractions: interactions.length,
            };
        },
    });
}
