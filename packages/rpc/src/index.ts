/**
 * @frak-labs/rpc
 *
 * Modern RPC communication layer for Frak Wallet SDK
 *
 * This package provides a type-safe, backward-compatible RPC system for
 * communication between the Frak Wallet and SDK clients.
 *
 * @example Client-side (SDK)
 * ```ts
 * import { createRpcClient } from '@frak-labs/rpc'
 *
 * const client = createRpcClient({
 *   transport: window,
 *   targetOrigin: 'https://wallet.frak.id'
 * })
 *
 * await client.connect()
 *
 * // One-shot request
 * const result = await client.request('frak_sendInteraction', productId, interaction)
 *
 * // Streaming request
 * for await (const status of client.stream('frak_listenToWalletStatus')) {
 *   console.log('Status:', status)
 * }
 * ```
 *
 * @example Wallet-side (Listener)
 * ```ts
 * import { createRpcListener } from '@frak-labs/rpc'
 *
 * const listener = createRpcListener({
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
 * @module @frak-labs/rpc
 */

// Core client and listener
export { createRpcClient } from "./client";
export type { RpcClient, RpcClientConfig } from "./client";

export { createRpcListener } from "./listener";
export type { RpcListener, RpcListenerConfig } from "./listener";

// RPC Schema
export type {
	IFrameRpcSchema,
	RpcMethod,
	RpcSchemaByMethod,
	RpcParameters,
	RpcReturnType,
	RpcResponseType,
	IsStreamMethod,
	StreamMethods,
	PromiseMethods,
	// Return types
	WalletStatusReturnType,
	SendInteractionReturnType,
	GetProductInformationReturnType,
	OpenSsoReturnType,
	TrackSsoReturnType,
	ModalRpcStepsResultType,
	DisplayEmbeddedWalletResultType,
	// Parameter types
	PreparedInteraction,
	OpenSsoParamsType,
	TrackSsoParamsType,
	ModalRpcStepsInput,
	ModalRpcMetadata,
	DisplayEmbeddedWalletParamsType,
	FrakWalletSdkConfigMetadata,
} from "./rpc-schema";

// Types
export type {
	RpcTransport,
	RpcMessage,
	RpcResponse,
	RpcError,
	RpcRequestContext,
	TypedRpcRequest,
	StreamEmitter,
	PromiseHandler,
	StreamHandler,
	ConnectionState,
	HandshakeConfig,
} from "./types";

export { FrakRpcError, RpcErrorCodes } from "./types";
