import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import {
    FrakRpcError,
    type SendInteractionParamsType,
    type SendInteractionReturnType,
} from "../../core";
import { sendInteraction } from "../../core/actions";
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
                throw new Error("No client available");
            }

            // Setup the listener
            const result = await sendInteraction(client, params);
            // todo: more granular error handling
            if (result.key !== "success") {
                throw new FrakRpcError("Error while sending transaction");
            }

            // Return our success result
            return result;
        },
    });
}
