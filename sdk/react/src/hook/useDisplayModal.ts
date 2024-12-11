import {
    ClientNotFound,
    type DisplayModalParamsType,
    type FrakRpcError,
    type ModalRpcStepsResultType,
    type ModalStepTypes,
} from "@frak-labs/core-sdk";
import { displayModal } from "@frak-labs/core-sdk/actions";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useNexusClient } from "./useNexusClient";

type MutationOptions<T extends ModalStepTypes[]> = Omit<
    UseMutationOptions<
        ModalRpcStepsResultType<T>,
        FrakRpcError,
        DisplayModalParamsType<T>
    >,
    "mutationFn" | "mutationKey"
>;

interface UseDisplayModalParams<T extends ModalStepTypes[] = ModalStepTypes[]> {
    mutations?: MutationOptions<T>;
}

/**
 * Send a user interaction
 */
export function useDisplayModal<T extends ModalStepTypes[] = ModalStepTypes[]>({
    mutations,
}: UseDisplayModalParams<T> = {}) {
    const client = useNexusClient();

    return useMutation({
        ...mutations,
        mutationKey: ["nexus-sdk", "display-modal"],
        mutationFn: async (args: DisplayModalParamsType<T>) => {
            if (!client) {
                throw new ClientNotFound();
            }

            // Ask to display the modal
            return displayModal(client, args);
        },
    });
}
