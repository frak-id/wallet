import type {
    ExtractMethod,
    ExtractParams,
    ExtractReturnType,
    RpcSchema,
} from "./rpc-schema";

/**
 * Transport interface for RPC communication
 * Abstracts the underlying message passing mechanism (postMessage, etc)
 */
export type RpcTransport = {
    /**
     * Send a message through the transport
     */
    postMessage: (message: RpcMessage, targetOrigin: string) => void;
    /**
     * Listen for messages
     */
    addEventListener: (
        type: "message",
        listener: (event: MessageEvent<RpcMessage>) => void
    ) => void;
    /**
     * Remove message listener
     */
    removeEventListener: (
        type: "message",
        listener: (event: MessageEvent<RpcMessage>) => void
    ) => void;
};

/**
 * RPC message format (maintains backward compatibility)
 * This is the exact format sent over the wire
 *
 * @typeParam TMethod - The method name type (defaults to string for flexibility)
 */
export type RpcMessage<TMethod extends string = string> = {
    /**
     * Unique message identifier for correlating requests and responses
     */
    id: string;
    /**
     * The RPC method name (topic for backward compatibility)
     */
    topic: TMethod;
    /**
     * The message payload (compressed data) or raw params
     */
    data: unknown;
};

/**
 * Lifecycle message format for client-to-iframe communication
 * These messages handle connection lifecycle events (handshake, heartbeat, etc.)
 */
export type ClientLifecycleMessage = {
    clientLifecycle: string;
    data?: unknown;
};

/**
 * Lifecycle message format for iframe-to-client communication
 */
export type IFrameLifecycleMessage = {
    iframeLifecycle: string;
    data?: unknown;
};

/**
 * Union of all lifecycle message types
 */
export type LifecycleMessage = ClientLifecycleMessage | IFrameLifecycleMessage;

/**
 * Union of all message types that can be received
 */
export type AnyMessage = RpcMessage | LifecycleMessage;

/**
 * RPC response wrapper
 * Contains either a successful result or an error
 */
export type RpcResponse<TResult = unknown> =
    | {
          result: TResult;
          error?: never;
      }
    | {
          result?: never;
          error: RpcError;
      };

/**
 * RPC error object
 */
export type RpcError = {
    code: number;
    message: string;
    data?: unknown;
};

/**
 * Request context for handlers
 * Contains information about the origin and source of the request
 */
export type RpcRequestContext = {
    /**
     * Origin of the request
     */
    origin: string;
    /**
     * Message source (for responding)
     */
    source: MessageEventSource | null;
};

/**
 * Middleware context that can be augmented with custom fields
 * Generic type parameter allows domain-specific context augmentation
 *
 * @typeParam TCustomContext - Custom context fields to merge with base context
 *
 * @example
 * ```ts
 * type WalletContext = RpcMiddlewareContext<{
 *   productId: string
 *   sourceUrl: string
 *   isAutoContext: boolean
 * }>
 * // { origin: string, source: MessageEventSource | null, productId: string, sourceUrl: string, isAutoContext: boolean }
 * ```
 */
export type RpcMiddlewareContext<TCustomContext = Record<string, never>> =
    RpcRequestContext & TCustomContext;

/**
 * Type-safe request parameters
 *
 * @typeParam TSchema - The RPC schema type
 * @typeParam TMethod - The method name from the schema
 */
export type TypedRpcRequest<
    TSchema extends RpcSchema,
    TMethod extends ExtractMethod<TSchema>,
> = {
    method: TMethod;
    params: ExtractParams<TSchema, TMethod>;
};

/**
 * Stream emitter function
 * Used by stream handlers to emit multiple values
 */
export type StreamEmitter<TResult> = (chunk: TResult) => void;

/**
 * Lifecycle handler function
 * Handles lifecycle events (handshake, heartbeat, etc.)
 *
 * @param event - The lifecycle event name
 * @param data - Optional event data
 * @param context - Request context with origin and source
 */
export type LifecycleHandler = (
    event: string,
    data: unknown,
    context: RpcRequestContext
) => void | Promise<void>;

/**
 * Unified middleware function for RPC requests (both listener and client)
 * Works on both listener-side (with context augmentation) and client-side (empty context)
 *
 * Key features:
 * - Can mutate message.data directly for efficiency (compression, validation)
 * - Can mutate response.result directly for transformation
 * - Listener-side: Can augment context by returning modified context
 * - Client-side: Uses TContext = {} (empty context), always returns unchanged
 *
 * @typeParam TSchema - The RPC schema type
 * @typeParam TContext - Custom context type to augment base context (empty {} for client-side)
 *
 * @example Listener-side with context augmentation
 * ```ts
 * type WalletContext = { productId: string, sourceUrl: string }
 * const contextMiddleware: RpcMiddleware<MySchema, WalletContext> = {
 *   onRequest: async (message, context) => {
 *     // Read from store and augment context
 *     const productId = await getProductId(context.origin)
 *     return { ...context, productId, sourceUrl: context.origin }
 *   }
 * }
 * ```
 *
 * @example Client-side (empty context)
 * ```ts
 * const compressionMiddleware: RpcMiddleware<MySchema> = {
 *   onRequest: async (message, context) => {
 *     // Mutate message.data directly
 *     message.data = compress(message.data)
 *     return context  // Empty context, unchanged
 *   },
 *   onResponse: async (message, response, context) => {
 *     // Mutate response.result directly
 *     response.result = decompress(response.result)
 *     return response
 *   }
 * }
 * ```
 *
 * @example Shared middleware (works on both sides)
 * ```ts
 * const loggingMiddleware: RpcMiddleware<MySchema> = {
 *   onRequest: async (message, context) => {
 *     console.log(`[RPC] ${message.topic}`, context.origin || 'client')
 *     return context
 *   },
 *   onResponse: async (message, response, context) => {
 *     console.log(`[RPC] ${message.topic} completed`)
 *     return response
 *   }
 * }
 * ```
 */
export type RpcMiddleware<
    TSchema extends RpcSchema,
    TContext = Record<string, never>,
> = {
    /**
     * Called before handler execution (listener) or before sending (client)
     *
     * For listener: Can augment context and mutate message
     * For client: Can mutate message, context is empty {}
     *
     * @param message - The RPC message (can be mutated)
     * @param context - Request context (listener-side) or empty (client-side)
     * @returns Updated context (listener mutates this, client returns unchanged)
     * @throws FrakRpcError to reject the request with a specific error code
     */
    onRequest?: (
        message: RpcMessage<ExtractMethod<TSchema>>,
        context: RpcMiddlewareContext<TContext>
    ) =>
        | Promise<RpcMiddlewareContext<TContext>>
        | RpcMiddlewareContext<TContext>;

    /**
     * Called after handler execution (listener) or after receiving (client)
     *
     * @param message - The original RPC message
     * @param response - The response (can be mutated)
     * @param context - Request context (listener-side) or empty (client-side)
     * @returns Transformed response
     * @throws Error to send an error response instead
     */
    onResponse?: (
        message: RpcMessage<ExtractMethod<TSchema>>,
        response: RpcResponse,
        context: RpcMiddlewareContext<TContext>
    ) => Promise<RpcResponse> | RpcResponse;
};

/**
 * Promise handler function type
 * Handles one-shot requests that return a single promise
 *
 * @typeParam TSchema - The RPC schema type
 * @typeParam TMethod - The method name from the schema
 * @typeParam TContext - Custom context type augmented by middleware
 */
export type RpcPromiseHandler<
    TSchema extends RpcSchema,
    TMethod extends ExtractMethod<TSchema>,
    TContext = Record<string, never>,
> = (
    params: ExtractParams<TSchema, TMethod>,
    context: RpcMiddlewareContext<TContext>
) => Promise<ExtractReturnType<TSchema, TMethod>>;

/**
 * Stream handler function type
 * Handles streaming requests that can emit multiple values
 *
 * @typeParam TSchema - The RPC schema type
 * @typeParam TMethod - The method name from the schema
 * @typeParam TContext - Custom context type augmented by middleware
 */
export type RpcStreamHandler<
    TSchema extends RpcSchema,
    TMethod extends ExtractMethod<TSchema>,
    TContext = Record<string, never>,
> = (
    params: ExtractParams<TSchema, TMethod>,
    emitter: StreamEmitter<ExtractReturnType<TSchema, TMethod>>,
    context: RpcMiddlewareContext<TContext>
) => Promise<void> | void;
