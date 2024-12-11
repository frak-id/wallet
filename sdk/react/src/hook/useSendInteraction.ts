import {
    ClientNotFound,
    type FrakRpcError,
    type SendInteractionParamsType,
    type SendInteractionReturnType,
} from "@frak-labs/core-sdk";
import { sendInteraction } from "@frak-labs/core-sdk/actions";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useNexusClient } from "./useNexusClient";

type MutationOptions = Omit<
    UseMutationOptions<
        SendInteractionReturnType,
        FrakRpcError,
        SendInteractionParamsType
    >,
    "mutationFn" | "mutationKey"
>;

interface UseSendInteractionParams {
    mutations?: MutationOptions;
}

/**
 * Send a user interaction
 */
export function useSendInteraction({
    mutations,
}: UseSendInteractionParams = {}) {
    const client = useNexusClient();

    return useMutation({
        ...mutations,
        mutationKey: ["nexus-sdk", "send-interaction"],
        mutationFn: async (params: SendInteractionParamsType) => {
            if (!client) {
                throw new ClientNotFound();
            }

            // Setup the listener
            return sendInteraction(client, params);
        },
    });
}
