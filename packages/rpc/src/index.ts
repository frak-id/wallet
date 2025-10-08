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

// Core client and listener
export { createRpcClient } from "./client";
export type { RpcClient, RpcClientConfig } from "./client";

export { createRpcListener } from "./listener";
export type { RpcListener, RpcListenerConfig } from "./listener";

// Generic RPC Schema types
export type {
    RpcSchema,
    RpcSchemaEntry,
    ExtractMethod,
    ExtractSchemaEntry,
    ExtractParams,
    ExtractReturnType,
    ExtractedParametersFromRpc,
} from "./rpc-schema";

// Transport and messaging types
export type {
    RpcTransport,
    RpcMessage,
    RpcResponse,
    RpcError,
    RpcRequestContext,
    RpcMiddlewareContext,
    RpcMiddleware,
    TypedRpcRequest,
    StreamEmitter,
    RpcPromiseHandler,
    RpcStreamHandler,
    // New message types
    LifecycleMessage,
    ClientLifecycleMessage,
    IFrameLifecycleMessage,
    AnyMessage,
    LifecycleHandler,
} from "./types";

export {
    FrakRpcError,
    MethodNotFoundError,
    InternalError,
    ClientNotFound,
    RpcErrorCodes,
} from "./error";

// Built-in middleware
export {
    createClientCompressionMiddleware,
    createListenerCompressionMiddleware,
} from "./middleware";

// Utils helpers
export { Deferred } from "./utils/deferred-promise";
export {
    compressJson,
    decompressJson,
    decompressDataAndCheckHash,
    hashAndCompressData,
    type CompressedData,
    type HashProtectedData,
} from "./utils/compression";
