import type {
    ExtractMethod,
    ExtractMethodsByKind,
    ExtractParams,
    ExtractReturnType,
    RpcSchema,
} from "./rpc-schema";
import type {
    ConnectionState,
    HandshakeConfig,
    RpcMessage,
    RpcResponse,
    RpcTransport,
} from "./types";

/**
 * RPC Client configuration
 *
 * @typeParam TSchema - The RPC schema type
 */
export type RpcClientConfig = {
    /**
     * The transport to use for communication (e.g., window or iframe.contentWindow)
     */
    transport: RpcTransport;
    /**
     * The target origin for postMessage
     */
    targetOrigin: string;
    /**
     * Optional handshake configuration
     */
    handshake?: HandshakeConfig;
};

/**
 * RPC Client interface
 * Provides methods for making RPC calls to the wallet
 *
 * @typeParam TSchema - The RPC schema type
 */
export type RpcClient<TSchema extends RpcSchema> = {
    /**
     * Connect and establish communication with the wallet
     * Should be called before making requests
     */
    connect: () => Promise<void>;

    /**
     * Make a one-shot request that returns a promise
     * Used for methods with ResponseType: "promise"
     */
    request: <TMethod extends ExtractMethodsByKind<TSchema, "promise">>(
        method: TMethod,
        ...params: ExtractParams<TSchema, TMethod> extends undefined
            ? []
            : [ExtractParams<TSchema, TMethod>]
    ) => Promise<ExtractReturnType<TSchema, TMethod>>;

    /**
     * Make a streaming request that returns an async iterator
     * Used for methods with ResponseType: "stream"
     */
    stream: <TMethod extends ExtractMethodsByKind<TSchema, "stream">>(
        method: TMethod,
        ...params: ExtractParams<TSchema, TMethod> extends undefined
            ? []
            : [ExtractParams<TSchema, TMethod>]
    ) => AsyncIterableIterator<ExtractReturnType<TSchema, TMethod>>;

    /**
     * Get the current connection state
     */
    getState: () => ConnectionState;

    /**
     * Clean up resources and close connections
     */
    cleanup: () => void;
};

/**
 * Pending request tracking
 */
type PendingRequest<T = unknown> = {
    resolve: (value: T) => void;
    reject: (error: Error) => void;
};

/**
 * Stream controller for managing async iteration
 */
type StreamController<T> = {
    push: (value: T) => void;
    error: (err: Error) => void;
    end: () => void;
};

/**
 * Create an RPC client for SDK-side communication
 *
 * @typeParam TSchema - The RPC schema type
 * @param config - Client configuration
 * @returns RPC client instance
 *
 * @example
 * ```ts
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
 *   console.log('Wallet status:', status)
 * }
 * ```
 */
export function createRpcClient<TSchema extends RpcSchema>(
    config: RpcClientConfig
): RpcClient<TSchema> {
    const { transport, targetOrigin, handshake } = config;

    // Connection state
    let state: ConnectionState = "disconnected";

    // Pending requests (for promise-based methods)
    const pendingRequests = new Map<string, PendingRequest<unknown>>();

    // Active streams (for streaming methods)
    const activeStreams = new Map<string, StreamController<unknown>>();

    // Message handler
    function handleMessage(
        event: MessageEvent<RpcMessage<ExtractMethod<TSchema>>>
    ) {
        // Validate origin
        try {
            const messageOrigin = new URL(event.origin).origin.toLowerCase();
            const expectedOrigin = new URL(targetOrigin).origin.toLowerCase();
            if (messageOrigin !== expectedOrigin) {
                return;
            }
        } catch (e) {
            console.error("[RPC Client] Invalid origin", e);
            return;
        }

        // Validate message format
        if (
            typeof event.data !== "object" ||
            !event.data ||
            !("id" in event.data) ||
            !("topic" in event.data) ||
            !("data" in event.data)
        ) {
            return;
        }

        const { id, data } = event.data;

        // Check if this is a response to a pending request
        const pending = pendingRequests.get(id);
        if (pending) {
            handlePromiseResponse(id, data, pending);
            return;
        }

        // Check if this is a stream update
        const stream = activeStreams.get(id);
        if (stream) {
            handleStreamResponse(id, data, stream);
            return;
        }
    }

    /**
     * Handle response for promise-based requests
     */
    function handlePromiseResponse(
        id: string,
        data: unknown,
        pending: PendingRequest<unknown>
    ) {
        const response = data as RpcResponse;

        if (response.error) {
            const error = new Error(response.error.message) as Error & {
                code: number;
                data?: unknown;
            };
            error.name = "FrakRpcError";
            error.code = response.error.code;
            error.data = response.error.data;
            pending.reject(error);
        } else {
            pending.resolve(response.result);
        }

        // Clean up
        pendingRequests.delete(id);
    }

    /**
     * Handle response for streaming requests
     */
    function handleStreamResponse(
        id: string,
        data: unknown,
        stream: StreamController<unknown>
    ) {
        const response = data as RpcResponse;

        if (response.error) {
            const error = new Error(response.error.message) as Error & {
                code: number;
                data?: unknown;
            };
            error.name = "FrakRpcError";
            error.code = response.error.code;
            error.data = response.error.data;
            stream.error(error);
            activeStreams.delete(id);
        } else {
            // Push the result to the stream
            stream.push(response.result);
        }
    }

    /**
     * Send a message through the transport
     */
    function sendMessage(message: RpcMessage<ExtractMethod<TSchema>>) {
        transport.postMessage(message, targetOrigin);
    }

    /**
     * Generate a unique request ID
     */
    function generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    // Set up message listener
    transport.addEventListener("message", handleMessage);

    /**
     * Connect and establish communication
     */
    async function connect(): Promise<void> {
        if (state === "connected") {
            return;
        }

        state = "connecting";

        // For now, we consider connected immediately
        // In Phase 2, we can add handshake logic here
        if (handshake?.required) {
            // TODO: Implement handshake protocol
            // This would involve sending a handshake request and waiting for response
        }

        state = "connected";
    }

    /**
     * Make a one-shot request
     */
    function request<TMethod extends ExtractMethodsByKind<TSchema, "promise">>(
        method: TMethod,
        ...params: ExtractParams<TSchema, TMethod> extends undefined
            ? []
            : [ExtractParams<TSchema, TMethod>]
    ): Promise<ExtractReturnType<TSchema, TMethod>> {
        if (state !== "connected") {
            return Promise.reject(
                new Error(
                    `[RPC Client] Not connected. Call connect() first. Current state: ${state}`
                )
            );
        }

        return new Promise<ExtractReturnType<TSchema, TMethod>>(
            (resolve, reject) => {
                const id = generateId();

                // Store the pending request
                pendingRequests.set(id, {
                    resolve: resolve as (value: unknown) => void,
                    reject,
                });

                // Send the message (maintaining backward compatible format)
                sendMessage({
                    id,
                    topic: method,
                    data: params[0],
                });
            }
        );
    }

    /**
     * Make a streaming request
     */
    async function* stream<
        TMethod extends ExtractMethodsByKind<TSchema, "stream">,
    >(
        method: TMethod,
        ...params: ExtractParams<TSchema, TMethod> extends undefined
            ? []
            : [ExtractParams<TSchema, TMethod>]
    ): AsyncIterableIterator<ExtractReturnType<TSchema, TMethod>> {
        if (state !== "connected") {
            throw new Error(
                `[RPC Client] Not connected. Call connect() first. Current state: ${state}`
            );
        }

        const id = generateId();

        // Create a queue for buffering stream values
        const queue: ExtractReturnType<TSchema, TMethod>[] = [];
        let resolveNext:
            | ((
                  value: IteratorResult<ExtractReturnType<TSchema, TMethod>>
              ) => void)
            | null = null;
        let streamEnded = false;
        let streamError: Error | null = null;

        // Create stream controller
        const controller: StreamController<
            ExtractReturnType<TSchema, TMethod>
        > = {
            push: (value: ExtractReturnType<TSchema, TMethod>) => {
                if (resolveNext) {
                    // If there's a pending read, resolve it immediately
                    resolveNext({ value, done: false });
                    resolveNext = null;
                } else {
                    // Otherwise, buffer the value
                    queue.push(value);
                }
            },
            error: (err: Error) => {
                streamError = err;
                streamEnded = true;
                if (resolveNext) {
                    resolveNext({ value: undefined, done: true });
                    resolveNext = null;
                }
            },
            end: () => {
                streamEnded = true;
                if (resolveNext) {
                    resolveNext({ value: undefined, done: true });
                    resolveNext = null;
                }
            },
        };

        // Register the stream
        activeStreams.set(id, controller as StreamController<unknown>);

        // Send the initial request
        sendMessage({
            id,
            topic: method,
            data: params[0],
        });

        // Yield values from the stream
        try {
            while (!streamEnded || queue.length > 0) {
                // If there's an error, throw it
                if (streamError) {
                    throw streamError;
                }

                // If there are queued values, yield them
                if (queue.length > 0) {
                    const value = queue.shift();
                    if (value !== undefined) {
                        yield value;
                    }
                    continue;
                }

                // If stream has ended and queue is empty, we're done
                if (streamEnded) {
                    break;
                }

                // Wait for the next value
                await new Promise<
                    IteratorResult<ExtractReturnType<TSchema, TMethod>>
                >((resolve) => {
                    resolveNext = resolve;
                });
            }
        } finally {
            // Clean up the stream
            activeStreams.delete(id);
        }
    }

    /**
     * Get current connection state
     */
    function getState(): ConnectionState {
        return state;
    }

    /**
     * Clean up resources
     */
    function cleanup() {
        // Remove message listener
        transport.removeEventListener("message", handleMessage);

        // Reject all pending requests
        for (const [id, pending] of pendingRequests.entries()) {
            pending.reject(new Error("[RPC Client] Client cleanup"));
            pendingRequests.delete(id);
        }

        // End all active streams
        for (const [id, stream] of activeStreams.entries()) {
            stream.end();
            activeStreams.delete(id);
        }

        state = "disconnected";
    }

    return {
        connect,
        request,
        stream,
        getState,
        cleanup,
    };
}
