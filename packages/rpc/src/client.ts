import { FrakRpcError } from "./error";
import type {
    ExtractedParametersFromRpc,
    ExtractedSpecificParametersFromRpc,
    ExtractMethod,
    ExtractReturnType,
    RpcSchema,
} from "./rpc-schema";
import type {
    LifecycleHandler,
    LifecycleMessage,
    RpcMessage,
    RpcMiddleware,
    RpcMiddlewareContext,
    RpcRequestContext,
    RpcResponse,
    RpcTransport,
} from "./types";
import { Deferred } from "./utils/deferred-promise";

/**
 * RPC Client configuration
 *
 * @typeParam TSchema - The RPC schema type
 * @typeParam TLifecycleEvent - Lifecycle event union type (e.g., ClientLifecycleEvent | IFrameLifecycleEvent)
 */
export type RpcClientConfig<
    TSchema extends RpcSchema,
    TLifecycleEvent = unknown,
> = {
    /**
     * The transport to use for emitting events (e.g., window or iframe.contentWindow)
     */
    emittingTransport: RpcTransport;
    /**
     * The transport to use for listening to events (e.g., window or iframe.contentWindow)
     */
    listeningTransport: RpcTransport;
    /**
     * The target origin for postMessage
     */
    targetOrigin: string;
    /**
     * Middleware stack (executed in order)
     * Middleware can transform outgoing requests and incoming responses
     * Client-side middleware uses empty context {}
     *
     * @example
     * ```ts
     * middleware: [
     *   compressionMiddleware,  // Compress outgoing, decompress incoming
     *   loggingMiddleware,      // Log RPC calls
     * ]
     * ```
     */
    middleware?: RpcMiddleware<TSchema>[];
    /**
     * Lifecycle event handlers
     * Handles incoming lifecycle events from the server
     *
     * @example
     * ```ts
     * lifecycleHandlers: {
     *   iframeLifecycle: (event, data) => {
     *     if (event === 'connected') {
     *       console.log('Wallet ready')
     *     }
     *   }
     * }
     * ```
     */
    lifecycleHandlers?: {
        clientLifecycle?: LifecycleHandler<
            Extract<TLifecycleEvent, { clientLifecycle: string }>
        >;
        iframeLifecycle?: LifecycleHandler<
            Extract<TLifecycleEvent, { iframeLifecycle: string }>
        >;
    };
};

/**
 * RPC Client interface
 * Provides methods for making RPC calls to the wallet
 *
 * @typeParam TSchema - The RPC schema type
 */
export type RpcClient<
    TSchema extends RpcSchema,
    TLifecycleEvent extends LifecycleMessage,
> = {
    /**
     * Make a one-shot request that returns a promise
     * Used for methods with ResponseType: "promise"
     */
    request: <TMethod extends ExtractMethod<TSchema>>(
        args: ExtractedSpecificParametersFromRpc<TSchema, TMethod>
    ) => Promise<ExtractReturnType<TSchema, TMethod>>;

    /**
     * Subscribe to a listener method with a callback
     * Used for methods with ResponseType: "stream"
     * Returns an unsubscribe function
     *
     * @example
     * ```ts
     * const unsubscribe = client.listen('frak_listenToWalletStatus', (status) => {
     *   console.log('Status:', status)
     * })
     *
     * // Later, unsubscribe
     * unsubscribe()
     * ```
     */
    listen: <TMethod extends ExtractMethod<TSchema>>(
        args: ExtractedSpecificParametersFromRpc<TSchema, TMethod>,
        callback: (result: ExtractReturnType<TSchema, TMethod>) => void
    ) => () => void;

    /**
     * Send a lifecycle event to the server
     * Bypasses middleware and is used for connection management
     *
     * @example
     * ```ts
     * client.sendLifecycle({ clientLifecycle: 'heartbeat' })
     * client.sendLifecycle({ clientLifecycle: 'modal-css', data: { cssLink: '...' } })
     * ```
     */
    sendLifecycle: (message: TLifecycleEvent) => void;

    /**
     * Clean up resources and close connections
     */
    cleanup: () => void;
};

/**
 * Channel callback function type
 */
type ChannelCallback = (response: RpcResponse) => void;

/**
 * Create an RPC client for SDK-side communication
 *
 * @typeParam TSchema - The RPC schema type
 * @typeParam TLifecycleEvent - Lifecycle event union type (e.g., ClientLifecycleEvent | IFrameLifecycleEvent)
 * @param config - Client configuration
 * @returns RPC client instance
 *
 * @example
 * ```ts
 * import type { IFrameRpcSchema, ClientLifecycleEvent, IFrameLifecycleEvent } from '@frak-labs/core-sdk'
 *
 * const client = createRpcClient<IFrameRpcSchema, ClientLifecycleEvent | IFrameLifecycleEvent>({
 *   emittingTransport: window,
 *   listeningTransport: window,
 *   targetOrigin: 'https://wallet.frak.id',
 *   lifecycleHandlers: {
 *     iframeLifecycle: (event, data) => {
 *       // event and data are now strongly typed!
 *     }
 *   }
 * })
 *
 * // One-shot request
 * const result = await client.request('frak_sendInteraction', [productId, interaction])
 *
 * // Listener
 * const unsubscribe = client.listen('frak_listenToWalletStatus', (status) => {
 *   console.log('Wallet status:', status)
 * })
 * ```
 */
export function createRpcClient<
    TSchema extends RpcSchema,
    TLifecycleEvent extends LifecycleMessage = LifecycleMessage,
>(
    config: RpcClientConfig<TSchema, TLifecycleEvent>
): RpcClient<TSchema, TLifecycleEvent> {
    const {
        emittingTransport,
        listeningTransport,
        targetOrigin,
        middleware = [],
        lifecycleHandlers,
    } = config;

    // Active channels map (stores callbacks for both requests and listeners)
    const activeChannels = new Map<string, ChannelCallback>();

    /**
     * Check if a message is a lifecycle message
     */
    function isLifecycleMessage(data: unknown): data is TLifecycleEvent {
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
     * Handle incoming lifecycle messages
     */
    async function handleLifecycleMessage(message: TLifecycleEvent) {
        try {
            if (
                "clientLifecycle" in message &&
                lifecycleHandlers?.clientLifecycle
            ) {
                await lifecycleHandlers.clientLifecycle(
                    message as Extract<
                        TLifecycleEvent,
                        { clientLifecycle: string }
                    >,
                    {
                        origin: targetOrigin,
                        source: null,
                    }
                );
            } else if (
                "iframeLifecycle" in message &&
                lifecycleHandlers?.iframeLifecycle
            ) {
                await lifecycleHandlers.iframeLifecycle(
                    message as Extract<
                        TLifecycleEvent,
                        { iframeLifecycle: string }
                    >,
                    {
                        origin: targetOrigin,
                        source: null,
                    }
                );
            }
        } catch (error) {
            console.error("[RPC Client] Lifecycle handler error:", error);
        }
    }

    /**
     * Execute middleware onRequest hooks in sequence
     */
    async function executeOnRequestMiddleware(
        message: RpcMessage<ExtractMethod<TSchema>>
    ): Promise<RpcMessage<ExtractMethod<TSchema>>> {
        const clientContext = {
            origin: targetOrigin,
            source: null,
        } as RpcRequestContext;

        for (const mw of middleware) {
            if (mw.onRequest) {
                await mw.onRequest(
                    message,
                    clientContext as RpcMiddlewareContext<Record<string, never>>
                );
            }
        }

        return message;
    }

    /**
     * Execute middleware onResponse hooks in sequence
     */
    async function executeOnResponseMiddleware(
        message: RpcMessage<ExtractMethod<TSchema>>,
        response: RpcResponse
    ): Promise<RpcResponse> {
        const clientContext = {
            origin: targetOrigin,
            source: null,
        } as RpcRequestContext;

        let finalResponse = response;
        for (const mw of middleware) {
            if (mw.onResponse) {
                finalResponse = await mw.onResponse(
                    message,
                    finalResponse,
                    clientContext as RpcMiddlewareContext<Record<string, never>>
                );
            }
        }

        return finalResponse;
    }

    /**
     * Handle incoming RPC messages
     */
    async function handleMessage(
        event: MessageEvent<RpcMessage<ExtractMethod<TSchema>>>
    ) {
        // Validate origin
        try {
            const messageOrigin = new URL(event.origin).origin.toLowerCase();
            const expectedOrigin = new URL(targetOrigin).origin.toLowerCase();
            if (messageOrigin !== expectedOrigin) {
                console.log(
                    "Not expected origin",
                    messageOrigin,
                    expectedOrigin
                );
                return;
            }
        } catch (e) {
            console.error("[RPC Client] Invalid origin", e);
            return;
        }

        // Route lifecycle messages (no middleware)
        if (isLifecycleMessage(event.data)) {
            await handleLifecycleMessage(event.data);
            return;
        }

        // Must be an RPC message
        if (!isRpcMessage(event.data)) {
            return;
        }

        // Apply middleware to incoming response
        let processedResponse: RpcResponse;
        try {
            // For backward compatibility with old compression format:
            // If message.data is compressed (Uint8Array), wrap it as {result: CompressedData}
            // so middleware can decompress it properly
            const messageData = event.data.data;
            const isCompressedData =
                messageData instanceof Uint8Array ||
                ArrayBuffer.isView(messageData);

            const responseToProcess: RpcResponse = isCompressedData
                ? { result: messageData }
                : (messageData as RpcResponse);

            processedResponse = await executeOnResponseMiddleware(
                event.data,
                responseToProcess
            );
        } catch (error) {
            console.error("[RPC Client] Middleware error on response:", error);
            return;
        }

        // Find and call the callback for this channel
        const callback = activeChannels.get(event.data.id);
        if (callback) {
            callback(processedResponse);
        }
    }

    /**
     * Send a message through the transport with middleware
     */
    async function sendMessage(message: RpcMessage<ExtractMethod<TSchema>>) {
        let processedMessage = message;
        try {
            processedMessage = await executeOnRequestMiddleware(message);
        } catch (error) {
            console.error("[RPC Client] Middleware error on request:", error);
            throw error;
        }

        emittingTransport.postMessage(processedMessage, targetOrigin);
    }

    /**
     * Send a lifecycle event (bypasses middleware)
     */
    function sendLifecycle(message: TLifecycleEvent) {
        emittingTransport.postMessage(
            message as unknown as RpcMessage,
            targetOrigin
        );
    }

    /**
     * Generate a unique channel ID
     */
    function generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    // Set up message listener
    listeningTransport.addEventListener("message", handleMessage);

    /**
     * Make a one-shot request that returns a promise
     */
    function request<TMethod extends ExtractMethod<TSchema>>(
        args: ExtractedParametersFromRpc<TSchema>
    ): Promise<ExtractReturnType<TSchema, TMethod>> {
        const id = generateId();
        const deferred = new Deferred<ExtractReturnType<TSchema, TMethod>>();

        // Create callback that resolves/rejects the deferred and closes the channel
        const callback = (response: RpcResponse) => {
            if (response.error) {
                deferred.reject(
                    new FrakRpcError(
                        response.error.code,
                        response.error.message,
                        response.error.data
                    )
                );
            } else {
                deferred.resolve(
                    response.result as ExtractReturnType<TSchema, TMethod>
                );
            }

            // Close channel after response
            activeChannels.delete(id);
        };

        // Store callback
        activeChannels.set(id, callback);

        // Send message
        sendMessage({
            id,
            topic: args.method,
            data: { method: args.method, params: args.params },
        }).catch((error) => {
            activeChannels.delete(id);
            deferred.reject(error);
        });

        return deferred.promise;
    }

    /**
     * Subscribe to a listener method with a callback
     */
    function listen<TMethod extends ExtractMethod<TSchema>>(
        args: ExtractedParametersFromRpc<TSchema>,
        callback: (result: ExtractReturnType<TSchema, TMethod>) => void
    ): () => void {
        const id = generateId();

        // Create callback that calls user's callback for each response
        const channelCallback = (response: RpcResponse) => {
            if (response.error) {
                console.error("[RPC Client] Listener error:", response.error);
                // Close channel on error
                activeChannels.delete(id);
            } else {
                // Call user's callback with the result
                callback(
                    response.result as ExtractReturnType<TSchema, TMethod>
                );
            }
        };

        // Store callback
        activeChannels.set(id, channelCallback);

        // Send message
        sendMessage({
            id,
            topic: args.method,
            data: { method: args.method, params: args.params },
        }).catch((error) => {
            console.error(
                "[RPC Client] Failed to send listener request:",
                error
            );
            activeChannels.delete(id);
        });

        // Return unsubscribe function that closes the channel
        return () => {
            activeChannels.delete(id);
        };
    }

    /**
     * Clean up resources
     */
    function cleanup() {
        // Remove message listener
        listeningTransport.removeEventListener("message", handleMessage);

        // Clear all active channels
        activeChannels.clear();
    }

    return {
        request,
        listen,
        sendLifecycle,
        cleanup,
    };
}
