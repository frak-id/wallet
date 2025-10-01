import type {
    ExtractMethod,
    ExtractMethodsByKind,
    RpcSchema,
} from "./rpc-schema";
import type {
    CustomMessage,
    CustomMessageHandler,
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
import { FrakRpcError, RpcErrorCodes } from "./types";

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
    /**
     * Custom message handler
     * Handles messages with a "type" field (e.g., SSO completion)
     *
     * @example
     * ```ts
     * customMessageHandler: (message, context) => {
     *   if (message.type === 'sso-complete') {
     *     handleSsoCompletion(message.payload)
     *   }
     * }
     * ```
     */
    customMessageHandler?: CustomMessageHandler;
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
    handle: <TMethod extends ExtractMethodsByKind<TSchema, "promise">>(
        method: TMethod,
        handler: RpcPromiseHandler<TSchema, TMethod, TContext>
    ) => void;

    /**
     * Register a handler for a streaming method
     */
    handleStream: <TMethod extends ExtractMethodsByKind<TSchema, "stream">>(
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
 * @typeParam TSchema - The RPC schema type
 * @typeParam TContext - Custom context type augmented by middleware
 * @param config - Listener configuration
 * @returns RPC listener instance
 *
 * @example
 * ```ts
 * import type { IFrameRpcSchema } from '@frak-labs/core-sdk'
 *
 * // Basic usage without middleware
 * const listener = createRpcListener<IFrameRpcSchema>({
 *   transport: window,
 *   allowedOrigins: ['https://example.com', 'https://app.example.com']
 * })
 *
 * // With middleware for context augmentation
 * type WalletContext = { productId: string, sourceUrl: string }
 * const listener = createRpcListener<IFrameRpcSchema, WalletContext>({
 *   transport: window,
 *   allowedOrigins: ['https://example.com'],
 *   middleware: [
 *     contextAugmentationMiddleware,
 *     loggingMiddleware
 *   ]
 * })
 *
 * // Register a promise handler (context now includes custom fields)
 * listener.handle('frak_sendInteraction', async (params, context) => {
 *   const [productId, interaction, signature] = params
 *   // context.productId and context.sourceUrl are available
 *   return { status: 'success', hash: '0x...' }
 * })
 *
 * // Register a stream handler
 * listener.handleStream('frak_listenToWalletStatus', (params, emit, context) => {
 *   emit({ key: 'connecting' })
 *   setTimeout(() => {
 *     emit({ key: 'connected', wallet: '0x...' })
 *   }, 1000)
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
        customMessageHandler,
    } = config;

    // Normalize allowed origins to an array
    const allowedOriginsList = Array.isArray(allowedOrigins)
        ? allowedOrigins
        : [allowedOrigins];

    // Handler registries
    const promiseHandlers = new Map<
        ExtractMethodsByKind<TSchema, "promise">,
        RpcPromiseHandler<
            TSchema,
            ExtractMethodsByKind<TSchema, "promise">,
            TContext
        >
    >();
    const streamHandlers = new Map<
        ExtractMethodsByKind<TSchema, "stream">,
        RpcStreamHandler<
            TSchema,
            ExtractMethodsByKind<TSchema, "stream">,
            TContext
        >
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
     * Check if a message is a custom message
     */
    function isCustomMessage(data: unknown): data is CustomMessage {
        if (typeof data !== "object" || !data) {
            return false;
        }
        return "type" in data && !("id" in data || "topic" in data);
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

        const message: RpcMessage<ExtractMethod<TSchema>> = {
            id,
            topic,
            data: response,
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
     * Handle custom messages
     * These bypass middleware and compression
     */
    async function handleCustomMessageInternal(
        message: CustomMessage,
        context: RpcRequestContext
    ) {
        if (!customMessageHandler) {
            return;
        }

        try {
            await customMessageHandler(message, context);
        } catch (error) {
            console.error(
                "[RPC Listener] Custom message handler error:",
                error
            );
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

        // Route custom messages (no middleware, no compression)
        if (isCustomMessage(event.data)) {
            await handleCustomMessageInternal(event.data, baseContext);
            return;
        }

        // Must be an RPC message - validate format
        if (!isRpcMessage(event.data)) {
            return;
        }

        // Handle RPC message with middleware
        const { id, topic, data } = event.data;

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
                id,
                topic,
                error instanceof Error ? error : new Error(String(error))
            );
            return;
        }

        // Check for promise handler
        const promiseHandler = promiseHandlers.get(
            topic as ExtractMethodsByKind<TSchema, "promise">
        );
        if (promiseHandler) {
            try {
                // Use type assertion since we know the handler matches the method (can fail)
                const result = await (
                    promiseHandler as (
                        params: unknown,
                        context: RpcMiddlewareContext<TContext>
                    ) => Promise<unknown>
                )(data, augmentedContext);

                // Execute middlware on the response (can fail)
                const response = await executeOnResponseMiddleware(
                    event.data,
                    { result },
                    augmentedContext
                );

                sendResponse(event.source, event.origin, id, topic, response);
            } catch (error) {
                sendError(
                    event.source,
                    event.origin,
                    id,
                    topic,
                    error instanceof Error ? error : new Error(String(error))
                );
            }
            return;
        }

        // Check for stream handler
        const streamHandler = streamHandlers.get(
            topic as ExtractMethodsByKind<TSchema, "stream">
        );
        if (streamHandler) {
            try {
                // Create an emitter function for the handler
                // Note: For streams, we apply onResponse middleware to each chunk
                const emitter: StreamEmitter<unknown> = async (chunk) => {
                    let response: RpcResponse = { result: chunk };
                    try {
                        response = await executeOnResponseMiddleware(
                            event.data,
                            response,
                            augmentedContext
                        );
                    } catch (error) {
                        // Log but don't fail the stream - just skip this chunk
                        console.error(
                            "[RPC Listener] Middleware failed on stream chunk:",
                            error
                        );
                        return;
                    }
                    sendResponse(
                        event.source,
                        event.origin,
                        id,
                        topic,
                        response
                    );
                };

                // Call the stream handler with type assertion
                await (
                    streamHandler as (
                        params: unknown,
                        emitter: StreamEmitter<unknown>,
                        context: RpcMiddlewareContext<TContext>
                    ) => Promise<void> | void
                )(data, emitter, augmentedContext);
            } catch (error) {
                sendError(
                    event.source,
                    event.origin,
                    id,
                    topic,
                    error instanceof Error ? error : new Error(String(error))
                );
            }
            return;
        }

        // No handler found
        console.error("[RPC Listener] No handler found for method:", topic);
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
    function handle<TMethod extends ExtractMethodsByKind<TSchema, "promise">>(
        method: TMethod,
        handler: RpcPromiseHandler<TSchema, TMethod, TContext>
    ): void {
        // Use type assertion to store in the map - we'll validate at call time
        promiseHandlers.set(
            method,
            handler as RpcPromiseHandler<
                TSchema,
                ExtractMethodsByKind<TSchema, "promise">,
                TContext
            >
        );
    }

    /**
     * Register a stream handler
     */
    function handleStream<
        TMethod extends ExtractMethodsByKind<TSchema, "stream">,
    >(
        method: TMethod,
        handler: RpcStreamHandler<TSchema, TMethod, TContext>
    ): void {
        // Use type assertion to store in the map - we'll validate at call time
        streamHandlers.set(
            method,
            handler as RpcStreamHandler<
                TSchema,
                ExtractMethodsByKind<TSchema, "stream">,
                TContext
            >
        );
    }

    /**
     * Unregister a handler
     */
    function unregister(method: ExtractMethod<TSchema>): void {
        promiseHandlers.delete(
            method as ExtractMethodsByKind<TSchema, "promise">
        );
        streamHandlers.delete(
            method as ExtractMethodsByKind<TSchema, "stream">
        );
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
