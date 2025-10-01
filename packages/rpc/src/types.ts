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
     * The message payload (compressed data)
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
 * Custom message format for non-RPC, non-lifecycle messages
 * Used for SSO completion, error notifications, etc.
 */
export type CustomMessage = {
    type: string;
    payload?: unknown;
};

/**
 * Union of all message types that can be received
 */
export type AnyMessage = RpcMessage | LifecycleMessage | CustomMessage;

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
 * RPC error codes
 */
export const RpcErrorCodes = {
    configError: -32001,
    clientNotConnected: -32002,
    userRejected: -32003,
    invalidRequest: -32600,
    methodNotFound: -32601,
    invalidParams: -32602,
    internalError: -32603,
    serverError: -32000,
} as const;

/**
 * Custom RPC error class
 */
export class FrakRpcError extends Error {
    constructor(
        public code: number,
        message: string,
        public data?: unknown
    ) {
        super(message);
        this.name = "FrakRpcError";
    }

    toJSON(): RpcError {
        return {
            code: this.code,
            message: this.message,
            data: this.data,
        };
    }
}

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
 * Custom message handler function
 * Handles custom messages (SSO completion, etc.)
 *
 * @param message - The custom message
 * @param context - Request context with origin and source
 */
export type CustomMessageHandler = (
    message: CustomMessage,
    context: RpcRequestContext
) => void | Promise<void>;

/**
 * Middleware function for RPC requests
 * Allows transformation of context and validation/modification of requests and responses
 *
 * @typeParam TSchema - The RPC schema type
 * @typeParam TContext - Custom context type to augment base context
 *
 * @example
 * ```ts
 * const loggingMiddleware: RpcMiddleware<MySchema> = {
 *   onRequest: async (message, context) => {
 *     console.log(`[RPC] ${message.topic} from ${context.origin}`)
 *     return context
 *   },
 *   onResponse: async (message, response, context) => {
 *     console.log(`[RPC] ${message.topic} completed`)
 *     return response
 *   }
 * }
 *
 * // Context augmentation example
 * type WalletContext = { productId: string, sourceUrl: string }
 * const contextMiddleware: RpcMiddleware<MySchema, WalletContext> = {
 *   onRequest: async (message, context) => {
 *     // Read from store and augment context
 *     const productId = await getProductId(context.origin)
 *     return { ...context, productId, sourceUrl: context.origin }
 *   }
 * }
 * ```
 */
export type RpcMiddleware<
    TSchema extends RpcSchema,
    TContext = Record<string, never>,
> = {
    /**
     * Called before handler execution
     * Can augment context with custom fields, validate requests, or reject by throwing
     *
     * @param message - The incoming RPC message
     * @param context - Current request context (augmented by previous middleware)
     * @returns Augmented context to pass to handler
     * @throws FrakRpcError to reject the request with a specific error code
     */
    onRequest?: (
        message: RpcMessage<ExtractMethod<TSchema>>,
        context: RpcMiddlewareContext<TContext>
    ) =>
        | Promise<RpcMiddlewareContext<TContext>>
        | RpcMiddlewareContext<TContext>;

    /**
     * Called after handler execution, before sending response
     * Can transform the response (e.g., compression), log, or perform cleanup
     *
     * @param message - The original RPC message
     * @param response - The handler's response
     * @param context - The augmented context from onRequest
     * @returns Transformed response to send to client
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

/**
 * Connection state
 */
export type ConnectionState = "disconnected" | "connecting" | "connected";

/**
 * Handshake configuration
 */
export type HandshakeConfig = {
    /**
     * Timeout for the handshake in milliseconds
     */
    timeout?: number;
    /**
     * Whether to require a handshake before sending requests
     */
    required?: boolean;
};
