import type { Address, Hex } from "viem";
import type { ModalStepType } from "./generic";

/**
 * Generic format representing a tx to be sent
 *  todo: exploit the EIP-5792 here? https://eips.ethereum.org/EIPS/eip-5792
 */
export type SendTransactionTxType = Readonly<{
    to: Address;
    data?: Hex;
    value?: Hex;
}>;

/**
 * Return type of the send transaction rpc request
 */
export type SendTransactionReturnType = Readonly<{
    hash: Hex;
}>;

export type SendTransactionModalStepType = ModalStepType<
    "sendTransaction",
    { tx: SendTransactionTxType | SendTransactionTxType[] },
    SendTransactionReturnType
>;
