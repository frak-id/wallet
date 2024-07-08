import type { RpcSchema } from "viem";
import type { Prettify } from "viem/chains";
import type { IFrameRpcSchema } from "./rpc";

/**
 * Type that extract the possible parameters from a RPC Schema
 */
export type ExtractedParametersFromRpc<TRpcSchema extends RpcSchema> = {
    [K in keyof TRpcSchema]: Prettify<
        {
            method: TRpcSchema[K] extends TRpcSchema[number]
                ? TRpcSchema[K]["Method"]
                : string;
        } & (TRpcSchema[K] extends TRpcSchema[number]
            ? TRpcSchema[K]["Parameters"] extends undefined
                ? { params?: never }
                : { params: TRpcSchema[K]["Parameters"] }
            : never)
    >;
}[number];

/**
 * Type that extract the possible return type from a RPC Schema
 */
export type ExtractedReturnTypeFromRpc<
    TRpcSchema extends RpcSchema,
    TParameters extends
        ExtractedParametersFromRpc<TRpcSchema> = ExtractedParametersFromRpc<TRpcSchema>,
> = ExtractedMethodFromRpc<TRpcSchema, TParameters["method"]>["ReturnType"];

/**
 * Type that extract the possible return type from a RPC Schema
 */
export type ExtractedMethodFromRpc<
    TRpcSchema extends RpcSchema,
    TMethod extends
        ExtractedParametersFromRpc<TRpcSchema>["method"] = ExtractedParametersFromRpc<TRpcSchema>["method"],
> = Extract<TRpcSchema[number], { Method: TMethod }>;

/**
 * Raw response that we will receive after an rpc request
 */
export type RpcResponse<
    TRpcSchema extends RpcSchema,
    TMethod extends TRpcSchema[number]["Method"] = TRpcSchema[number]["Method"],
> =
    | {
          result: Extract<
              TRpcSchema[number],
              { Method: TMethod }
          >["ReturnType"];
          error?: never;
      }
    | {
          result?: never;
          error: {
              code: number;
              message: string;
              data?: unknown;
          };
      };

/**
 * Type used for a one shot request function
 */
export type RequestFn<TRpcSchema extends RpcSchema> = <
    TParameters extends
        ExtractedParametersFromRpc<TRpcSchema> = ExtractedParametersFromRpc<TRpcSchema>,
    _ReturnType = ExtractedReturnTypeFromRpc<TRpcSchema, TParameters>,
>(
    args: TParameters
) => Promise<_ReturnType>;

/**
 * Type used for a one shot request function
 */
export type ListenerRequestFn<TRpcSchema extends RpcSchema> = <
    TParameters extends
        ExtractedParametersFromRpc<TRpcSchema> = ExtractedParametersFromRpc<TRpcSchema>,
>(
    args: TParameters,
    callback: (
        result: ExtractedReturnTypeFromRpc<TRpcSchema, TParameters>
    ) => void
) => Promise<void>;

/**
 * IFrame transport interface
 */
export type IFrameTransport = {
    /**
     * Wait for the connection to be established
     */
    waitForConnection: Promise<boolean>;
    /**
     * Function used to perform a single request via the iframe transport
     */
    request: RequestFn<IFrameRpcSchema>;
    /**
     * Function used to listen to a request response via the iframe transport
     */
    listenerRequest: ListenerRequestFn<IFrameRpcSchema>;
    /**
     * Function used to destroy the iframe transport
     */
    destroy: () => Promise<void>;
};

/**
 * Represent an iframe event
 */
export type IFrameEvent = IFrameRpcEvent | IFrameLifecycleEvent;

/**
 * Represent an iframe rpc event
 */
export type IFrameRpcEvent = {
    id: string;
    topic: ExtractedParametersFromRpc<IFrameRpcSchema>["method"];
    data: {
        compressed: string;
        compressedHash: string;
    };
};

type IFrameLifecycleEvent = {
    lifecycle: "connected" | "show" | "hide";
};
