import {
    FrakRpcError,
    type NexusClient,
    type SendTransactionActionParamsType,
    type SendTransactionReturnType,
} from "../types";
import { RpcErrorCodes } from "../types/rpc/error";

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
): Promise<Extract<SendTransactionReturnType, { key: "success" }>> {
    const result = await client.request({
        method: "frak_sendTransaction",
        params: [tx, context],
    });

    switch (result.key) {
        case "aborted":
            throw new FrakRpcError(
                RpcErrorCodes.clientAborted,
                "The client has aborted the operation"
            );
        case "error":
            throw new FrakRpcError(
                RpcErrorCodes.serverError,
                result.reason ??
                    "An error occurred while sending the transaction"
            );
        case "success":
            return result;
    }
}
