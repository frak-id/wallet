import type {
    SendTransactionActionParamsType,
    SendTransactionReturnType,
} from "@frak-labs/nexus-sdk/core";

export type SendTransactionListenerParam = SendTransactionActionParamsType & {
    emitter: (response: SendTransactionReturnType) => Promise<void>;
};
