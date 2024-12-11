import {
    ClientNotFound,
    type FrakRpcError,
    type SendTransactionReturnType,
} from "@frak-labs/core-sdk";
import {
    type SendTransactionParams,
    sendTransaction,
} from "@frak-labs/core-sdk/actions";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useNexusClient } from "./useNexusClient";

type MutationOptions = Omit<
    UseMutationOptions<
        SendTransactionReturnType,
        FrakRpcError,
        SendTransactionParams
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
        mutationFn: async (params: SendTransactionParams) => {
            if (!client) {
                throw new ClientNotFound();
            }

            // Send the transaction
            return sendTransaction(client, params);
        },
    });
}
