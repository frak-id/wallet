import type {
    FrakClient,
    ModalRpcMetadata,
    SendTransactionModalStepType,
    SendTransactionReturnType,
} from "../../types";
import { displayModal } from "../displayModal";

export type SendTransactionParams = {
    tx: SendTransactionModalStepType["params"]["tx"];
    metadata?: ModalRpcMetadata;
};

/**
 * Function used to send a user transaction
 * @param client
 * @param tx
 * @param context
 */
export async function sendTransaction(
    client: FrakClient,
    { tx, metadata }: SendTransactionParams
): Promise<SendTransactionReturnType> {
    // Trigger a modal with login options
    const result = await displayModal(client, {
        metadata,
        steps: {
            login: {},
            sendTransaction: { tx },
        },
    });

    // Return the tx result only
    return result.sendTransaction;
}
