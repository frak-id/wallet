import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import {
    FrakRpcError,
    type SendTransactionActionParamsType,
    type SendTransactionReturnType,
} from "../../core";
import { sendTransactionAction } from "../../core/actions";
import { useNexusClient } from "./useNexusClient";

type MutationOptions = Omit<
    UseMutationOptions<
        Extract<SendTransactionReturnType, { key: "success" }>,
        FrakRpcError,
        SendTransactionActionParamsType
    >,
    "mutationFn" | "mutationKey"
>;

interface UseSendTransactionParams {
    mutations?: MutationOptions;
}

/**
 * Trigger a dashboard action to the wallet
 */
export function useSendTransactionAction({
    mutations,
}: UseSendTransactionParams = {}) {
    const client = useNexusClient();

    return useMutation({
        ...mutations,
        mutationKey: ["nexus-sdk", "send-transaction"],
        mutationFn: async (params: SendTransactionActionParamsType) => {
            if (!client) {
                throw new Error("No client available");
            }

            // Setup the listener
            const result = await sendTransactionAction(client, params);
            if (result.key !== "success") {
                throw new FrakRpcError("Error while sending transaction");
            }

            // Return our success result
            return result;
        },
    });
}
