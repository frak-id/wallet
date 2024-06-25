import { useMutation } from "@tanstack/react-query";
import { sendTransactionAction } from "../../core/actions";
import type {
    SendTransactionActionParamsType,
    SendTransactionReturnType,
} from "../../core";
import { useNexusClient } from "./useNexusClient";

type SendTransactionActionHookParams = SendTransactionActionParamsType & {
    callback: (data: SendTransactionReturnType) => void;
};

/**
 * Trigger a dashboard action to the wallet
 */
export function useSendTransactionAction({
    tx,
    context,
    callback,
}: SendTransactionActionHookParams) {
    const client = useNexusClient();

    return useMutation({
        mutationKey: [
            "nexus-sdk",
            "send-transaction",
            JSON.stringify(tx),
            context ?? "no-context",
        ],
        mutationFn: async () => {
            if (!client) {
                throw new Error("No client available");
            }

            // Setup the listener
            return await sendTransactionAction(
                client,
                { tx, context },
                callback
            );
        },
    });
}
