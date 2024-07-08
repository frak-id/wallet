import type {
    NexusClient,
    SendTransactionActionParamsType,
    SendTransactionReturnType,
} from "../types";

/**
 * Function used to send a user transaction
 * @param client
 * @param tx
 * @param context
 * @param callback
 */
export async function sendTransaction(
    client: NexusClient,
    { tx, context }: SendTransactionActionParamsType
): Promise<SendTransactionReturnType> {
    return await client.request({
        method: "frak_sendTransaction",
        params: [tx, context],
    });
}
