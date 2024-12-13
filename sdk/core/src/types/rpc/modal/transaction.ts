import type { Address, Hex } from "viem";
import type { GenericModalStepType } from "./generic";

/**
 * Generic format representing a tx to be sent
 */
export type SendTransactionTxType = {
    to: Address;
    data?: Hex;
    value?: Hex;
};

/**
 * Return type of the send transaction rpc request
 * @inline
 */
export type SendTransactionReturnType = {
    hash: Hex;
};

/**
 * The send transaction step for a Modal
 *
 * **Input**: Either a single tx or an array of tx to be sent
 * **Output**: The hash of the tx(s) hash (in case of multiple tx, still returns a single hash because it's bundled on the wallet level)
 *
 * @group Modal Display
 */
export type SendTransactionModalStepType = GenericModalStepType<
    "sendTransaction",
    { tx: SendTransactionTxType | SendTransactionTxType[] },
    SendTransactionReturnType
>;
