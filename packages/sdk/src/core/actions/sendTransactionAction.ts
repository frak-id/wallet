import type {
    NexusClient,
    SendTransactionActionParamsType,
    SendTransactionReturnType,
} from "../types";

/**
 * Function used to watch a dashboard action
 * @param client
 * @param tx
 * @param context
 * @param callback
 */
export function sendTransactionAction(
    client: NexusClient,
    { tx, context }: SendTransactionActionParamsType,
    callback: (status: SendTransactionReturnType) => void
) {
    return client.listenerRequest(
        {
            method: "frak_sendTransaction",
            params: [tx, context],
        },
        callback
    );
}
