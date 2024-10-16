import type { Address, Hex } from "viem";
import type { GenericModalStepType } from "./generic";

/**
 * Generic format representing a tx to be sent
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

export type SendTransactionModalStepType = GenericModalStepType<
    "sendTransaction",
    { tx: SendTransactionTxType | SendTransactionTxType[] },
    SendTransactionReturnType
>;
