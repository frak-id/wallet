import { authenticatedBackendApi } from "@/context/common/backendClient";
import { pushBackupData } from "@/context/sdk/utils/backup";
import { useGetSafeSdkSession } from "@/module/common/hook/useGetSafeSdkSession";
import {
    cleanPendingInteractionsAtom,
    pendingInteractionAtom,
} from "@/module/wallet/atoms/pendingInteraction";
import { useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useAtomValue } from "jotai/index";
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
        mutationKey: ["interactions", "consume-pending"],
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
