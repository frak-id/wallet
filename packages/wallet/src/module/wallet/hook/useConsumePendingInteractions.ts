import { pushInteractions } from "@/context/interaction/action/pushInteraction";
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

            // Submit the interactions
            const txHash = await pushInteractions({
                wallet: address,
                toPush: interactions,
            });

            // Clean the pending interactions
            cleanPendingInteractions();

            return {
                txHash,
                submittedInteractions: interactions.length,
            };
        },
    });
}
