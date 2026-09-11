/**
 * Type-safe RPC over cross-window `postMessage`, generic over the consumer's
 * own schema type.
 *
 * @example Client side
 * ```ts
 * const client = createRpcClient<IFrameRpcSchema>({
 *   emittingTransport: window,
 *   listeningTransport: window,
 *   targetOrigin: 'https://wallet.frak.id'
 * })
 *
 * const result = await client.request({
 *   method: 'frak_sendInteraction',
 *   params: [interaction]
 * })
 * const unsubscribe = client.listen(
 *   { method: 'frak_listenToWalletStatus' },
 *   (status) => setStatus(status)
 * )
 * ```
 *
 * @example Listener side
 * ```ts
 * const listener = createRpcListener<IFrameRpcSchema>({
 *   transport: window,
 *   allowedOrigins: ['https://example.com']
 * })
 *
 * listener.handle('frak_sendInteraction', async (params, context) => ({
 *   status: 'success'
 * }))
 * ```
 *
 * @module @frak-labs/frame-connector
 */

export type { RpcClient, RpcClientConfig } from "./client";
// Core client and listener
export { createRpcClient } from "./client";
export { ClientNotFound, FrakRpcError, RpcErrorCodes } from "./error";
export type { RpcListener, RpcListenerConfig } from "./listener";
export { createRpcListener } from "./listener";
// Generic RPC Schema types
export type {
    ExtractedParametersFromRpc,
    ExtractMethod,
    ExtractParams,
    ExtractReturnType,
    ExtractSchemaEntry,
    RpcSchema,
    RpcSchemaEntry,
} from "./rpc-schema";
// Transport and messaging types
export type {
    AnyMessage,
    ClientLifecycleMessage,
    IFrameLifecycleMessage,
    LifecycleHandler,
    // New message types
    LifecycleMessage,
    RpcError,
    RpcMessage,
    RpcMiddleware,
    RpcMiddlewareContext,
    RpcPromiseHandler,
    RpcRequestContext,
    RpcResponse,
    RpcStreamHandler,
    RpcTransport,
    StreamEmitter,
    TypedRpcRequest,
} from "./types";
// Utils helpers
export { Deferred } from "./utils/deferred-promise";
export { jsonDecode, jsonEncode } from "./utils/json";
