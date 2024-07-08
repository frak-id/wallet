import type {
    IFrameRpcSchema,
    RpcResponse,
    SendTransactionActionParamsType,
} from "@frak-labs/nexus-sdk/core";

export type SendTransactionListenerParam = SendTransactionActionParamsType & {
    emitter: (
        response: RpcResponse<IFrameRpcSchema, "frak_sendTransaction">
    ) => Promise<void>;
};
