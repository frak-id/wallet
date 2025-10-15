/**
 * @frak-labs/frame-connector
 *
 * Type-safe RPC communication layer for cross-window postMessage
 *
 * This package provides a framework-agnostic, generic RPC system for
 * bidirectional communication over postMessage. It's designed to be
 * completely generic over the RPC schema type - consumers provide their
 * own schema definitions.
 *
 * @example Client-side usage
 * ```ts
 * import { createRpcClient } from '@frak-labs/frame-connector'
 * import type { IFrameRpcSchema } from '@frak-labs/core-sdk'
 *
 * const client = createRpcClient<IFrameRpcSchema>({
 *   transport: window,
 *   targetOrigin: 'https://wallet.frak.id'
 * })
 *
 * await client.connect()
 *
 * // One-shot request
 * const result = await client.request('frak_sendInteraction', [productId, interaction])
 *
 * // Streaming request
 * for await (const status of client.stream('frak_listenToWalletStatus')) {
 *   console.log('Status:', status)
 * }
 * ```
 *
 * @example Server-side usage
 * ```ts
 * import { createRpcListener } from '@frak-labs/frame-connector'
 * import type { IFrameRpcSchema } from '@frak-labs/core-sdk'
 *
 * const listener = createRpcListener<IFrameRpcSchema>({
 *   transport: window,
 *   allowedOrigins: ['https://example.com']
 * })
 *
 * listener.handle('frak_sendInteraction', async (params, context) => {
 *   // Handle the interaction
 *   return { status: 'success', hash: '0x...' }
 * })
 *
 * listener.handleStream('frak_listenToWalletStatus', (params, emit, context) => {
 *   // Emit wallet status updates
 *   emit({ key: 'connected', wallet: '0x...' })
 * })
 * ```
 *
 * @module @frak-labs/frame-connector
 */

export type { RpcClient, RpcClientConfig } from "./client";
// Core client and listener
export { createRpcClient } from "./client";
export {
    ClientNotFound,
    FrakRpcError,
    InternalError,
    MethodNotFoundError,
    RpcErrorCodes,
} from "./error";
export type { RpcListener, RpcListenerConfig } from "./listener";
export { createRpcListener } from "./listener";
// Built-in middleware
export {
    createClientCompressionMiddleware,
    createListenerCompressionMiddleware,
} from "./middleware";
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
export {
    type CompressedData,
    compressJson,
    decompressDataAndCheckHash,
    decompressJson,
    type HashProtectedData,
    hashAndCompressData,
} from "./utils/compression";
// Utils helpers
export { Deferred } from "./utils/deferred-promise";
