import type {
    SendTransactionActionParamsType,
    SendTransactionReturnType,
} from "@frak-labs/nexus-sdk/core";

export type SendTransactionListenerParam = {
    tx: SendTransactionActionParamsType["tx"];
    context: SendTransactionActionParamsType["context"];
    emitter: (response: SendTransactionReturnType) => Promise<void>;
};
