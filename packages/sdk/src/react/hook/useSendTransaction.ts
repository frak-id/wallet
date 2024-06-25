import { useMutation } from "@tanstack/react-query";
import type {
    SendTransactionActionParamsType,
    SendTransactionReturnType,
} from "../../core";
import { sendTransactionAction } from "../../core/actions";
import { useNexusClient } from "./useNexusClient";

type SendTransactionActionHookParams = {
    callback: (data: SendTransactionReturnType) => void;
};

/**
 * Trigger a dashboard action to the wallet
 */
export function useSendTransactionAction({
    callback,
}: SendTransactionActionHookParams) {
    const client = useNexusClient();

    return useMutation({
        mutationKey: ["nexus-sdk", "send-transaction"],
        mutationFn: async (params: SendTransactionActionParamsType) => {
            if (!client) {
                throw new Error("No client available");
            }

            // Setup the listener
            return await sendTransactionAction(client, params, callback);
        },
    });
}
