import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import type {
    FrakRpcError,
    SendInteractionParamsType,
    SendInteractionReturnType,
} from "../../core";
import { sendInteraction } from "../../core/actions";
import { ClientNotFound } from "../../core/types/rpc/error";
import { useNexusClient } from "./useNexusClient";

type MutationOptions = Omit<
    UseMutationOptions<
        Extract<SendInteractionReturnType, { key: "success" }>,
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
