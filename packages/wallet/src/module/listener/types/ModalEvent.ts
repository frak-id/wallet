import type {
    IFrameRpcSchema,
    RpcResponse,
    SendTransactionActionParamsType,
    SiweAuthenticationParams,
} from "@frak-labs/nexus-sdk/core";

/**
 * Represent listener modal data
 */
export type ModalEventRequestArgs =
    | {
          type: "auth";
          args: {
              siwe: SiweAuthenticationParams;
              context?: string;
          };
          emitter: (
              response: RpcResponse<IFrameRpcSchema, "frak_siweAuthenticate">
          ) => Promise<void>;
      }
    | {
          type: "transaction";
          args: SendTransactionActionParamsType;
          emitter: (
              response: RpcResponse<IFrameRpcSchema, "frak_sendTransaction">
          ) => Promise<void>;
      };
