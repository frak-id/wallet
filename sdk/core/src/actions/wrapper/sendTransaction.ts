import type {
    FrakClient,
    ModalRpcMetadata,
    SendTransactionModalStepType,
    SendTransactionReturnType,
} from "../../types";
import { displayModal } from "../displayModal";

/**
 * @ignore
 * @inline
 */
export type SendTransactionParams = {
    /**
     * The transaction to be sent (either a single tx or multiple ones)
     */
    tx: SendTransactionModalStepType["params"]["tx"];
    /**
     * Custom metadata to be passed to the modal
     */
    metadata?: ModalRpcMetadata;
};

/**
 * Function used to send a user transaction, simple wrapper around the displayModal function to ease the send transaction process
 * @param client - The current Frak Client
 * @param args - The parameters
 * @returns The hash of the transaction that was sent in a promise
 *
 * @description This function will display a modal to the user with the provided transaction and metadata.
 *
 * @example
 * const { hash } = await sendTransaction(frakConfig, {
 *     tx: {
 *         to: "0xdeadbeef",
 *         value: toHex(100n),
 *     },
 *     metadata: {
 *         header: {
 *             title: "Sending eth",
 *         },
 *         context: "Send 100wei to 0xdeadbeef",
 *     },
 * });
 * console.log("Transaction hash:", hash);
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
