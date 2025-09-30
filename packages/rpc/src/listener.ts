import type { PromiseMethods, RpcMethod, StreamMethods } from "./rpc-schema";
import type {
	PromiseHandler,
	RpcMessage,
	RpcRequestContext,
	RpcResponse,
	RpcTransport,
	StreamEmitter,
	StreamHandler,
} from "./types";
import { FrakRpcError, RpcErrorCodes } from "./types";

/**
 * RPC Listener configuration
 */
export type RpcListenerConfig = {
	/**
	 * The transport to use for communication (e.g., window)
	 */
	transport: RpcTransport;
	/**
	 * Allowed origins for security
	 * Can be a single origin or array of origins
	 */
	allowedOrigins: string | string[];
};

/**
 * RPC Listener interface
 * Handles incoming RPC requests from the SDK
 */
export type RpcListener = {
	/**
	 * Register a handler for a promise-based method
	 */
	handle: <TMethod extends PromiseMethods>(
		method: TMethod,
		handler: PromiseHandler<TMethod>,
	) => void;

	/**
	 * Register a handler for a streaming method
	 */
	handleStream: <TMethod extends StreamMethods>(
		method: TMethod,
		handler: StreamHandler<TMethod>,
	) => void;

	/**
	 * Unregister a handler
	 */
	unregister: (method: RpcMethod) => void;

	/**
	 * Clean up resources
	 */
	cleanup: () => void;
};

/**
 * Create an RPC listener for Wallet-side communication
 *
 * @param config - Listener configuration
 * @returns RPC listener instance
 *
 * @example
 * ```ts
 * const listener = createRpcListener({
 *   transport: window,
 *   allowedOrigins: ['https://example.com', 'https://app.example.com']
 * })
 *
 * // Register a promise handler
 * listener.handle('frak_sendInteraction', async (params, context) => {
 *   const [productId, interaction, signature] = params
 *   // Process interaction...
 *   return { status: 'success', hash: '0x...' }
 * })
 *
 * // Register a stream handler
 * listener.handleStream('frak_listenToWalletStatus', (params, emit, context) => {
 *   // Emit initial status
 *   emit({ key: 'connecting' })
 *
 *   // Later, emit updates
 *   setTimeout(() => {
 *     emit({ key: 'connected', wallet: '0x...' })
 *   }, 1000)
 * })
 * ```
 */
export function createRpcListener(config: RpcListenerConfig): RpcListener {
	const { transport, allowedOrigins } = config;

	// Normalize allowed origins to an array
	const allowedOriginsList = Array.isArray(allowedOrigins)
		? allowedOrigins
		: [allowedOrigins];

	// Handler registries
	const promiseHandlers = new Map<
		PromiseMethods,
		PromiseHandler<PromiseMethods>
	>();
	const streamHandlers = new Map<StreamMethods, StreamHandler<StreamMethods>>();

	/**
	 * Check if an origin is allowed
	 */
	function isOriginAllowed(origin: string): boolean {
		try {
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
	 * Send a response message
	 */
	function sendResponse(
		source: MessageEventSource | null,
		origin: string,
		id: string,
		topic: RpcMethod,
		response: RpcResponse,
	) {
		if (!source) {
			console.error("[RPC Listener] No source to send response to");
			return;
		}

		const message: RpcMessage = {
			id,
			topic,
			data: response,
		};

		// Check if source has postMessage method
		if ("postMessage" in source && typeof source.postMessage === "function") {
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
		topic: RpcMethod,
		error: FrakRpcError | Error,
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
	 * Handle incoming messages
	 */
	async function handleMessage(event: MessageEvent<RpcMessage>) {
		// Validate origin
		if (!isOriginAllowed(event.origin)) {
			console.warn(
				"[RPC Listener] Message from disallowed origin:",
				event.origin,
			);
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

		const { id, topic, data } = event.data;

		// Build request context
		const context: RpcRequestContext = {
			origin: event.origin,
			source: event.source,
		};

		// Check for promise handler
		const promiseHandler = promiseHandlers.get(topic as PromiseMethods);
		if (promiseHandler) {
			try {
				// Use type assertion since we know the handler matches the method
				const result = await (
					promiseHandler as (
						params: unknown,
						context: RpcRequestContext,
					) => Promise<unknown>
				)(data, context);
				sendResponse(event.source, event.origin, id, topic, { result });
			} catch (error) {
				sendError(
					event.source,
					event.origin,
					id,
					topic,
					error instanceof Error ? error : new Error(String(error)),
				);
			}
			return;
		}

		// Check for stream handler
		const streamHandler = streamHandlers.get(topic as StreamMethods);
		if (streamHandler) {
			try {
				// Create an emitter function for the handler
				const emitter: StreamEmitter<unknown> = (chunk) => {
					sendResponse(event.source, event.origin, id, topic, {
						result: chunk,
					});
				};

				// Call the stream handler with type assertion
				await (
					streamHandler as (
						params: unknown,
						emitter: StreamEmitter<unknown>,
						context: RpcRequestContext,
					) => Promise<void> | void
				)(data, emitter, context);
			} catch (error) {
				sendError(
					event.source,
					event.origin,
					id,
					topic,
					error instanceof Error ? error : new Error(String(error)),
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
				`Method not found: ${topic}`,
			),
		);
	}

	// Set up message listener
	transport.addEventListener("message", handleMessage);

	/**
	 * Register a promise handler
	 */
	function handle<TMethod extends PromiseMethods>(
		method: TMethod,
		handler: PromiseHandler<TMethod>,
	): void {
		// Use type assertion to store in the map - we'll validate at call time
		promiseHandlers.set(
			method,
			handler as unknown as PromiseHandler<PromiseMethods>,
		);
	}

	/**
	 * Register a stream handler
	 */
	function handleStream<TMethod extends StreamMethods>(
		method: TMethod,
		handler: StreamHandler<TMethod>,
	): void {
		// Use type assertion to store in the map - we'll validate at call time
		streamHandlers.set(
			method,
			handler as unknown as StreamHandler<StreamMethods>,
		);
	}

	/**
	 * Unregister a handler
	 */
	function unregister(method: RpcMethod): void {
		promiseHandlers.delete(method as PromiseMethods);
		streamHandlers.delete(method as StreamMethods);
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
