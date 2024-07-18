import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import type {
    DisplayModalParamsType,
    FrakRpcError,
    ModalRpcResponse,
    ModalTypes,
} from "../../core";
import { displayModal } from "../../core/actions/displayModal";
import { ClientNotFound } from "../../core/types/rpc/error";
import { useNexusClient } from "./useNexusClient";

type MutationOptions<TModalTypes extends ModalTypes[] = ModalTypes[]> = Omit<
    UseMutationOptions<
        ModalRpcResponse<TModalTypes>,
        FrakRpcError,
        DisplayModalParamsType<TModalTypes>
    >,
    "mutationFn" | "mutationKey"
>;

interface UseDisplayModalParams {
    mutations?: MutationOptions;
}

/**
 * Send a user interaction
 */
export function useDisplayModal({ mutations }: UseDisplayModalParams = {}) {
    const client = useNexusClient();

    return useMutation({
        ...mutations,
        mutationKey: ["nexus-sdk", "display-modal"],
        mutationFn: async <TModalTypes extends ModalTypes[]>(
            args: DisplayModalParamsType<TModalTypes>
        ) => {
            if (!client) {
                throw new ClientNotFound();
            }

            // Ask to display the modal
            return displayModal(client, args);
        },
    });
}
