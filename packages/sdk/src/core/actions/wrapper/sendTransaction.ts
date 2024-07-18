import type {
    NexusClient,
    SendTransactionModalStepType,
    SendTransactionReturnType,
} from "../../types";
import { displayModal } from "../displayModal";

export type SendTransactionParams = {
    tx: SendTransactionModalStepType["params"]["tx"];
    context?: string;
};

/**
 * Function used to send a user transaction
 * @param client
 * @param tx
 * @param context
 * @param callback
 */
export async function sendTransaction(
    client: NexusClient,
    { tx, context }: SendTransactionParams
): Promise<SendTransactionReturnType> {
    // Trigger a modal with login options
    const result = await displayModal(client, {
        context,
        steps: {
            login: {},
            sendTransaction: { tx },
        },
    });

    // Return the tx result only
    return result.sendTransaction;
}
