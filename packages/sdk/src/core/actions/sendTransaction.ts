import type { NexusClient, SendTransactionActionParamsType } from "../types";

/**
 * Function used to send a user transaction
 * @param client
 * @param tx
 * @param context
 * @param callback
 */
export function sendTransaction(
    client: NexusClient,
    { tx, context }: SendTransactionActionParamsType
) {
    return client.request({
        method: "frak_sendTransaction",
        params: [tx, context],
    });
}
