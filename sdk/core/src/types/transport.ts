import type { RpcSchema } from "viem";
import type { Prettify } from "viem/chains";
import type { ClientLifecycleEvent, IFrameLifecycleEvent } from "./lifecycle";
import type { IFrameRpcSchema } from "./rpc";

/**
 * Type that extract the possible parameters from a RPC Schema
 * @ignore
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
 * @ignore
 */
export type ExtractedReturnTypeFromRpc<
    TRpcSchema extends RpcSchema,
    TParameters extends
        ExtractedParametersFromRpc<TRpcSchema> = ExtractedParametersFromRpc<TRpcSchema>,
> = ExtractedMethodFromRpc<TRpcSchema, TParameters["method"]>["ReturnType"];

/**
 * Type that extract the possible return type from a RPC Schema
 * @ignore
 */
export type ExtractedMethodFromRpc<
    TRpcSchema extends RpcSchema,
    TMethod extends
        ExtractedParametersFromRpc<TRpcSchema>["method"] = ExtractedParametersFromRpc<TRpcSchema>["method"],
> = Extract<TRpcSchema[number], { Method: TMethod }>;

/**
 * Raw response that we will receive after an rpc request
 * @ignore
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
 * @inline
 */
export type RequestFn<TRpcSchema extends RpcSchema> = <
    TParameters extends
        ExtractedParametersFromRpc<TRpcSchema> = ExtractedParametersFromRpc<TRpcSchema>,
    _ReturnType = ExtractedReturnTypeFromRpc<TRpcSchema, TParameters>,
>(
    args: TParameters
) => Promise<_ReturnType>;

/**
 * Type used for a listening request
 * @inline
 */
export type ListenerRequestFn<TRpcSchema extends RpcSchema> = <
    TParameters extends
        ExtractedParametersFromRpc<TRpcSchema> = ExtractedParametersFromRpc<TRpcSchema>,
    _ReturnType = ExtractedReturnTypeFromRpc<TRpcSchema, TParameters>,
>(
    args: TParameters,
    callback: (result: _ReturnType) => void
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
     * Wait for the setup to be done
     */
    waitForSetup: Promise<void>;
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
export type IFrameEvent =
    | IFrameRpcEvent
    | IFrameLifecycleEvent
    | ClientLifecycleEvent;

/**
 * Represent an iframe rpc event
 */
export type IFrameRpcEvent = {
    id: string;
    topic: ExtractedParametersFromRpc<IFrameRpcSchema>["method"];
    data: string;
};
