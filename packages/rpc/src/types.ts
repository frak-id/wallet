import type { RpcMethod, RpcParameters, RpcReturnType } from "./rpc-schema";

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
		listener: (event: MessageEvent<RpcMessage>) => void,
	) => void;
	/**
	 * Remove message listener
	 */
	removeEventListener: (
		type: "message",
		listener: (event: MessageEvent<RpcMessage>) => void,
	) => void;
};

/**
 * RPC message format (maintains backward compatibility)
 * This is the exact format sent over the wire
 */
export type RpcMessage = {
	/**
	 * Unique message identifier for correlating requests and responses
	 */
	id: string;
	/**
	 * The RPC method name (topic for backward compatibility)
	 */
	topic: RpcMethod;
	/**
	 * The message payload (compressed data)
	 */
	data: unknown;
};

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
		public data?: unknown,
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
 * Type-safe request parameters
 */
export type TypedRpcRequest<TMethod extends RpcMethod> = {
	method: TMethod;
	params: RpcParameters<TMethod>;
};

/**
 * Stream emitter function
 * Used by stream handlers to emit multiple values
 */
export type StreamEmitter<TResult> = (chunk: TResult) => void;

/**
 * Promise handler function type
 * Handles one-shot requests that return a single promise
 */
export type PromiseHandler<TMethod extends RpcMethod> = (
	params: RpcParameters<TMethod>,
	context: RpcRequestContext,
) => Promise<RpcReturnType<TMethod>>;

/**
 * Stream handler function type
 * Handles streaming requests that can emit multiple values
 */
export type StreamHandler<TMethod extends RpcMethod> = (
	params: RpcParameters<TMethod>,
	emitter: StreamEmitter<RpcReturnType<TMethod>>,
	context: RpcRequestContext,
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
