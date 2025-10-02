import { FrakRpcError, RpcErrorCodes } from "./error";
import type { ExtractMethod, RpcSchema } from "./rpc-schema";
import type {
    LifecycleHandler,
    LifecycleMessage,
    RpcMessage,
    RpcMiddleware,
    RpcMiddlewareContext,
    RpcPromiseHandler,
    RpcRequestContext,
    RpcResponse,
    RpcStreamHandler,
    RpcTransport,
    StreamEmitter,
} from "./types";

/**
 * RPC Listener configuration
 *
 * @typeParam TContext - Custom context type to augment base context
 */
export type RpcListenerConfig<TContext = Record<string, never>> = {
    /**
     * The transport to use for communication (e.g., window)
     */
    transport: RpcTransport;
    /**
     * Allowed origins for security
     * Can be a single origin or array of origins
     */
    allowedOrigins: string | string[];
    /**
     * Middleware stack (executed in order)
     * Middleware can augment context, validate requests, and transform responses
     *
     * Note: Middleware only applies to RPC messages, not lifecycle or custom messages
     *
     * @example
     * ```ts
     * middleware: [
     *   loggingMiddleware,
     *   compressionMiddleware,
     *   contextAugmentationMiddleware
     * ]
     * ```
     */
    middleware?: RpcMiddleware<RpcSchema, TContext>[];
    /**
     * Lifecycle event handlers
     * Handles client-to-iframe and iframe-to-client lifecycle events
     *
     * @example
     * ```ts
     * lifecycleHandlers: {
     *   clientLifecycle: (event, data, context) => {
     *     if (event === 'heartbeat') {
     *       console.log('Client heartbeat received')
     *     }
     *   }
     * }
     * ```
     */
    lifecycleHandlers?: {
        clientLifecycle?: LifecycleHandler;
        iframeLifecycle?: LifecycleHandler;
    };
};

/**
 * RPC Listener interface
 * Handles incoming RPC requests from the SDK
 *
 * @typeParam TSchema - The RPC schema type
 * @typeParam TContext - Custom context type augmented by middleware
 */
export type RpcListener<
    TSchema extends RpcSchema,
    TContext = Record<string, never>,
> = {
    /**
     * Register a handler for a promise-based method
     */
    handle: <TMethod extends ExtractMethod<TSchema>>(
        method: TMethod,
        handler: RpcPromiseHandler<TSchema, TMethod, TContext>
    ) => void;

    /**
     * Register a handler for a streaming method
     */
    handleStream: <TMethod extends ExtractMethod<TSchema>>(
        method: TMethod,
        handler: RpcStreamHandler<TSchema, TMethod, TContext>
    ) => void;

    /**
     * Unregister a handler
     */
    unregister: (method: ExtractMethod<TSchema>) => void;

    /**
     * Clean up resources
     */
    cleanup: () => void;
};

/**
 * Create an RPC listener for Wallet-side communication
 *
 * Supports multiple schemas via union types, enabling a single listener to handle
 * different RPC protocols (e.g., IFrameRpcSchema | SsoRpcSchema).
 *
 * @typeParam TSchema - The RPC schema type (can be a union of multiple schemas)
 * @typeParam TContext - Custom context type augmented by middleware
 * @param config - Listener configuration
 * @returns RPC listener instance
 *
 * @example
 * ```ts
 * import type { IFrameRpcSchema, SsoRpcSchema } from '@frak-labs/core-sdk'
 *
 * // Single schema
 * const listener = createRpcListener<IFrameRpcSchema>({
 *   transport: window,
 *   allowedOrigins: ['https://example.com']
 * })
 *
 * // Multiple schemas (union type)
 * type CombinedSchema = IFrameRpcSchema | SsoRpcSchema
 * const listener = createRpcListener<CombinedSchema, WalletContext>({
 *   transport: window,
 *   allowedOrigins: '*',
 *   middleware: [compressionMiddleware, contextMiddleware]
 * })
 *
 * // Register handlers for IFrame methods
 * listener.handle('frak_sendInteraction', async (params, context) => {
 *   return { status: 'success', hash: '0x...' }
 * })
 *
 * // Register handlers for SSO methods
 * listener.handle('sso_complete', async (params, context) => {
 *   const [session, sdkJwt, ssoId] = params
 *   return { success: true }
 * })
 * ```
 */
export function createRpcListener<
    TSchema extends RpcSchema,
    TContext = Record<string, never>,
>(config: RpcListenerConfig<TContext>): RpcListener<TSchema, TContext> {
    const {
        transport,
        allowedOrigins,
        middleware = [],
        lifecycleHandlers,
    } = config;

    // Normalize allowed origins to an array
    const allowedOriginsList = Array.isArray(allowedOrigins)
        ? allowedOrigins
        : [allowedOrigins];

    // Handler registries
    const promiseHandlers = new Map<
        ExtractMethod<TSchema>,
        RpcPromiseHandler<TSchema, ExtractMethod<TSchema>, TContext>
    >();
    const streamHandlers = new Map<
        ExtractMethod<TSchema>,
        RpcStreamHandler<TSchema, ExtractMethod<TSchema>, TContext>
    >();

    /**
     * Check if an origin is allowed
     */
    function isOriginAllowed(origin: string): boolean {
        try {
            // Special case: "*" allows all origins
            if (allowedOriginsList.includes("*")) {
                return true;
            }

            const messageOrigin = new URL(origin).origin.toLowerCase();
            return allowedOriginsList.some((allowed) => {
                const allowedOrigin = new URL(allowed).origin.toLowerCase();
                return messageOrigin === allowedOrigin;
            });
        } catch (e) {
            console.error("[RPC Listener] Invalid origin", e);
            return false;
        }
    }

    /**
     * Check if a message is a lifecycle message
     */
    function isLifecycleMessage(data: unknown): data is LifecycleMessage {
        if (typeof data !== "object" || !data) {
            return false;
        }
        return "clientLifecycle" in data || "iframeLifecycle" in data;
    }

    /**
     * Check if a message is an RPC message
     */
    function isRpcMessage(data: unknown): data is RpcMessage {
        if (typeof data !== "object" || !data) {
            return false;
        }
        return "id" in data && "topic" in data && "data" in data;
    }

    /**
     * Execute middleware onRequest hooks in sequence
     * Each middleware can augment the context
     */
    async function executeOnRequestMiddleware(
        message: RpcMessage<ExtractMethod<TSchema>>,
        baseContext: RpcRequestContext
    ): Promise<RpcMiddlewareContext<TContext>> {
        let context: RpcMiddlewareContext<TContext> =
            baseContext as RpcMiddlewareContext<TContext>;

        for (const mw of middleware) {
            if (mw.onRequest) {
                context = await mw.onRequest(message, context);
            }
        }

        return context;
    }

    /**
     * Execute middleware onResponse hooks in sequence
     * Each middleware can transform the response
     */
    async function executeOnResponseMiddleware(
        message: RpcMessage<ExtractMethod<TSchema>>,
        response: RpcResponse,
        context: RpcMiddlewareContext<TContext>
    ): Promise<RpcResponse> {
        let currentResponse = response;

        for (const mw of middleware) {
            if (mw.onResponse) {
                currentResponse = await mw.onResponse(
                    message,
                    currentResponse,
                    context
                );
            }
        }

        return currentResponse;
    }

    /**
     * Send a response message
     */
    function sendResponse(
        source: MessageEventSource | null,
        origin: string,
        id: string,
        topic: ExtractMethod<TSchema>,
        response: RpcResponse
    ) {
        if (!source) {
            console.error("[RPC Listener] No source to send response to");
            return;
        }

        // For backward compatibility with old compression format:
        // If response.result is compressed (Uint8Array), send it directly as message.data
        // instead of wrapping it in {result: CompressedData}
        const isCompressedResponse =
            !response.error &&
            (response.result instanceof Uint8Array ||
                ArrayBuffer.isView(response.result));

        const message: RpcMessage<ExtractMethod<TSchema>> = {
            id,
            topic,
            data: isCompressedResponse ? response.result : response,
        };

        // Check if source has postMessage method
        if (
            "postMessage" in source &&
            typeof source.postMessage === "function"
        ) {
            source.postMessage(message, { targetOrigin: origin });
        }
    }

    /**
     * Send an error response
     */
    function sendError(
        source: MessageEventSource | null,
        origin: string,
        id: string,
        topic: ExtractMethod<TSchema>,
        error: FrakRpcError | Error
    ) {
        const rpcError =
            error instanceof FrakRpcError
                ? error.toJSON()
                : {
                      code: RpcErrorCodes.internalError,
                      message: error.message,
                  };

        sendResponse(source, origin, id, topic, { error: rpcError });
    }

    /**
     * Handle lifecycle messages
     * These bypass middleware and compression
     */
    async function handleLifecycleMessage(
        message: LifecycleMessage,
        context: RpcRequestContext
    ) {
        try {
            if (
                "clientLifecycle" in message &&
                lifecycleHandlers?.clientLifecycle
            ) {
                await lifecycleHandlers.clientLifecycle(
                    message.clientLifecycle,
                    message.data,
                    context
                );
            } else if (
                "iframeLifecycle" in message &&
                lifecycleHandlers?.iframeLifecycle
            ) {
                await lifecycleHandlers.iframeLifecycle(
                    message.iframeLifecycle,
                    message.data,
                    context
                );
            }
        } catch (error) {
            console.error("[RPC Listener] Lifecycle handler error:", error);
        }
    }

    /**
     * Handle incoming messages
     * Routes messages to appropriate handlers based on message type
     */
    async function handleMessage(event: MessageEvent) {
        // Validate origin
        if (!isOriginAllowed(event.origin)) {
            console.warn(
                "[RPC Listener] Message from disallowed origin:",
                event.origin
            );
            return;
        }

        // Build base request context (used by all message types)
        const baseContext: RpcRequestContext = {
            origin: event.origin,
            source: event.source,
        };

        // Route lifecycle messages (no middleware, no compression)
        if (isLifecycleMessage(event.data)) {
            await handleLifecycleMessage(event.data, baseContext);
            return;
        }

        // Must be an RPC message - validate format
        if (!isRpcMessage(event.data)) {
            return;
        }

        // Execute onRequest middleware to augment context
        let augmentedContext: RpcMiddlewareContext<TContext>;
        try {
            augmentedContext = await executeOnRequestMiddleware(
                event.data,
                baseContext
            );
        } catch (error) {
            // Middleware rejected the request
            sendError(
                event.source,
                event.origin,
                event.data.id,
                event.data.topic,
                error instanceof Error ? error : new Error(String(error))
            );
            return;
        }

        // Try to handle the rpc message
        try {
            await handleRpcMessage(event, augmentedContext);
        } catch (error) {
            sendError(
                event.source,
                event.origin,
                event.data.id,
                event.data.topic,
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }

    /**
     * Inner function to directly handle an rpc message
     */
    async function handleRpcMessage(
        event: MessageEvent<RpcMessage>,
        context: RpcMiddlewareContext<TContext>
    ) {
        // Refetch the id, topic and data after middleware passes
        const { id, topic, data } = event.data;

        // Check for promise handler
        const promiseHandler = promiseHandlers.get(
            topic as ExtractMethod<TSchema>
        );
        if (promiseHandler) {
            // Use type assertion since we know the handler matches the method (can fail)
            const result = await promiseHandler(data, context);

            // Execute middlware on the response (can fail)
            const response = await executeOnResponseMiddleware(
                event.data,
                { result },
                context
            );

            sendResponse(event.source, event.origin, id, topic, response);
            return;
        }

        // Check for stream handler
        const streamHandler = streamHandlers.get(
            topic as ExtractMethod<TSchema>
        );
        if (streamHandler) {
            // Create an emitter function for the handler
            // Note: For streams, we apply onResponse middleware to each chunk
            const emitter: StreamEmitter<unknown> = async (chunk) => {
                let response: RpcResponse;
                try {
                    response = await executeOnResponseMiddleware(
                        event.data,
                        { result: chunk },
                        context
                    );
                } catch (error) {
                    // Log but don't fail the stream - just skip this chunk
                    console.error(
                        "[RPC Listener] Middleware failed on stream chunk:",
                        error
                    );
                    return;
                }
                sendResponse(event.source, event.origin, id, topic, response);
            };

            // Call the stream handler with type assertion
            await streamHandler(data, emitter, context);
            return;
        }

        // No handler found
        console.error("[RPC Listener] No handler found for method:", {
            topic,
            handlers: streamHandlers.keys(),
            promiseHandler: promiseHandlers.keys(),
        });
        sendError(
            event.source,
            event.origin,
            id,
            topic,
            new FrakRpcError(
                RpcErrorCodes.methodNotFound,
                `Method not found: ${topic}`
            )
        );
    }

    // Set up message listener
    transport.addEventListener("message", handleMessage);

    /**
     * Register a promise handler
     */
    function handle<TMethod extends ExtractMethod<TSchema>>(
        method: TMethod,
        handler: RpcPromiseHandler<TSchema, TMethod, TContext>
    ): void {
        // Use type assertion to store in the map - we'll validate at call time
        promiseHandlers.set(
            method,
            handler as RpcPromiseHandler<
                TSchema,
                ExtractMethod<TSchema>,
                TContext
            >
        );
    }

    /**
     * Register a stream handler
     */
    function handleStream<TMethod extends ExtractMethod<TSchema>>(
        method: TMethod,
        handler: RpcStreamHandler<TSchema, TMethod, TContext>
    ): void {
        // Use type assertion to store in the map - we'll validate at call time
        streamHandlers.set(
            method,
            handler as RpcStreamHandler<
                TSchema,
                ExtractMethod<TSchema>,
                TContext
            >
        );
    }

    /**
     * Unregister a handler
     */
    function unregister(method: ExtractMethod<TSchema>): void {
        promiseHandlers.delete(method as ExtractMethod<TSchema>);
        streamHandlers.delete(method as ExtractMethod<TSchema>);
    }

    /**
     * Clean up resources
     */
    function cleanup(): void {
        // Remove message listener
        transport.removeEventListener("message", handleMessage);

        // Clear all handlers
        promiseHandlers.clear();
        streamHandlers.clear();
    }

    return {
        handle,
        handleStream,
        unregister,
        cleanup,
    };
}
