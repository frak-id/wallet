import type {
    IFrameRpcSchema,
    RpcResponse,
    SiweAuthenticationParams,
} from "@frak-labs/nexus-sdk/core";

export type SiweAuthenticateListenerParam = {
    siweMessage: SiweAuthenticationParams;
    context?: string;
    emitter: (
        response: RpcResponse<IFrameRpcSchema, "frak_siweAuthenticate">
    ) => Promise<void>;
};
