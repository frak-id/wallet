import {
    cleanPendingInteractionsAtom,
    pendingInteractionAtom,
} from "@/module/wallet/atoms/pendingInteraction";
import { useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useAtomValue } from "jotai/index";

/**
 * Hook used to consume the pending interactions
 */
export function useConsumePendingInteractions() {
    const { interactions } = useAtomValue(pendingInteractionAtom);
    const cleanPendingInteractions = useSetAtom(cleanPendingInteractionsAtom);

    return useMutation({
        mutationKey: ["interactions", "consume-pending"],
        mutationFn: async () => {
            // If no interactions, return
            if (!interactions.length) {
                return;
            }

            // todo: submit the interactions

            cleanPendingInteractions();
        },
    });
}
