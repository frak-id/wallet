import type { NexusClient, SendTransactionActionParamsType } from "../types";

/**
 * Function used to watch a dashboard action
 * @param client
 * @param tx
 * @param context
 * @param callback
 */
export function sendTransactionAction(
    client: NexusClient,
    { tx, context }: SendTransactionActionParamsType
) {
    return client.request({
        method: "frak_sendTransaction",
        params: [tx, context],
    });
}
