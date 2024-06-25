import type {
    SendTransactionActionParamsType,
    SendTransactionReturnType,
} from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai";

export type SendTransactionListenerParam = {
    tx: SendTransactionActionParamsType["tx"];
    context: SendTransactionActionParamsType["context"];
    emitter: (response: SendTransactionReturnType) => Promise<void>;
};

/**
 * Atom representing the current dashboard action listener
 */
export const sendTransactionListenerAtom =
    atom<SendTransactionListenerParam | null>(null);
