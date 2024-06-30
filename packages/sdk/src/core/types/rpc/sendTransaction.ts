import type { Address, Hex } from "viem";

/**
 * Parameters of the send transaction rpc request
 */
export type SendTransactionRpcParamsType = [
    tx: SendTransactionTxType | SendTransactionTxType[],
    context?: string,
];

/**
 * Same stuff but in an object format for better readability
 */
export type SendTransactionActionParamsType = Readonly<{
    tx: SendTransactionTxType | SendTransactionTxType[];
    context?: string;
}>;

export type SendTransactionTxType = Readonly<{
    to: Address;
    data: Hex;
    value: Hex;
}>;

/**
 * Return type of the send transaction rpc request
 */
export type SendTransactionReturnType =
    | SendTransactionSuccess
    | SendTransactionError;

type SendTransactionSuccess = Readonly<{
    key: "success";
    hash: Hex;
}>;
type SendTransactionError = Readonly<{
    key: "error" | "aborted";
    reason?: string;
}>;
