import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import type {
    FrakRpcError,
    SendTransactionActionParamsType,
    SendTransactionReturnType,
} from "../../core";
import { sendTransaction } from "../../core/actions";
import { ClientNotFound } from "../../core/types/rpc/error";
import { useNexusClient } from "./useNexusClient";

type MutationOptions = Omit<
    UseMutationOptions<
        SendTransactionReturnType,
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
                throw new ClientNotFound();
            }

            // Send the transaction
            return sendTransaction(client, params);
        },
    });
}
