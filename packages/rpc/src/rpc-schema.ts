import type { Hex } from "viem";

/**
 * Wallet status return type
 * Indicates the current state of the wallet connection
 */
export type WalletStatusReturnType =
	| { key: "connecting" }
	| { key: "connected"; wallet: Hex }
	| { key: "not-connected" };

/**
 * Modal RPC step types
 */
export type ModalRpcStepsInput = unknown;
export type ModalRpcStepsResultType = unknown;
export type ModalRpcMetadata = unknown;

/**
 * Embedded wallet types
 */
export type DisplayEmbeddedWalletParamsType = unknown;
export type DisplayEmbeddedWalletResultType = unknown;

/**
 * Interaction types
 */
export type PreparedInteraction = unknown;
export type SendInteractionReturnType = {
	hash?: Hex;
	status: "success" | "error";
};

/**
 * Product information types
 */
export type GetProductInformationReturnType = {
	productId?: Hex;
	hasActiveCampaign?: boolean;
};

/**
 * SSO types
 */
export type OpenSsoParamsType = {
	redirectUrl?: string;
};
export type OpenSsoReturnType = {
	token?: string;
};

export type TrackSsoParamsType = {
	ssoId: string;
};
export type TrackSsoReturnType = {
	status: "pending" | "success" | "error";
};

/**
 * Config metadata type
 */
export type FrakWalletSdkConfigMetadata = {
	name: string;
	css?: {
		primaryColor?: string;
	};
};

/**
 * RPC interface that's used for the iframe communication
 *
 * Define all the methods available within the iFrame RPC client with response type annotations
 *
 * @group RPC Schema
 *
 * @remarks
 * Each method in the schema now includes a ResponseType field that indicates:
 * - "promise": One-shot request that resolves once
 * - "stream": Streaming request that can emit multiple values
 *
 * ### Methods:
 *
 * #### frak_listenToWalletStatus
 *  - Params: None
 *  - Returns: {@link WalletStatusReturnType}
 *  - Response Type: stream (emits updates when wallet status changes)
 *
 * #### frak_displayModal
 * - Params: [requests: {@link ModalRpcStepsInput}, metadata?: {@link ModalRpcMetadata}, configMetadata: {@link FrakWalletSdkConfigMetadata}]
 * - Returns: {@link ModalRpcStepsResultType}
 * - Response Type: promise (one-shot)
 *
 * #### frak_sendInteraction
 *  - Params: [productId: Hex, interaction: {@link PreparedInteraction}, signature?: Hex]
 *  - Returns: {@link SendInteractionReturnType}
 *  - Response Type: promise (one-shot)
 *
 * #### frak_sso
 *  - Params: [params: {@link OpenSsoParamsType}, name: string, customCss?: string]
 *  - Returns: {@link OpenSsoReturnType}
 *  - Response Type: promise (one-shot)
 *
 * #### frak_trackSso
 *  - Params: [params: {@link TrackSsoParamsType}]
 *  - Returns: {@link TrackSsoReturnType}
 *  - Response Type: promise (one-shot)
 *
 * #### frak_getProductInformation
 *  - Params: None
 *  - Returns: {@link GetProductInformationReturnType}
 *  - Response Type: promise (one-shot)
 *
 * #### frak_displayEmbeddedWallet
 * - Params: [request: {@link DisplayEmbeddedWalletParamsType}, metadata: {@link FrakWalletSdkConfigMetadata}]
 * - Returns: {@link DisplayEmbeddedWalletResultType}
 * - Response Type: promise (one-shot)
 */
export type IFrameRpcSchema = [
	/**
	 * Method used to listen to the wallet status
	 * This is a streaming method that emits updates when wallet status changes
	 */
	{
		Method: "frak_listenToWalletStatus";
		Parameters?: undefined;
		ReturnType: WalletStatusReturnType;
		ResponseType: "stream";
	},
	/**
	 * Method to display a modal with the provided steps
	 * This is a one-shot request
	 */
	{
		Method: "frak_displayModal";
		Parameters: [
			requests: ModalRpcStepsInput,
			metadata: ModalRpcMetadata | undefined,
			configMetadata: FrakWalletSdkConfigMetadata,
		];
		ReturnType: ModalRpcStepsResultType;
		ResponseType: "promise";
	},
	/**
	 * Method to transmit a user interaction
	 * This is a one-shot request
	 */
	{
		Method: "frak_sendInteraction";
		Parameters: [
			productId: Hex,
			interaction: PreparedInteraction,
			signature?: Hex,
		];
		ReturnType: SendInteractionReturnType;
		ResponseType: "promise";
	},
	/**
	 * Method to start a SSO
	 * This is a one-shot request
	 */
	{
		Method: "frak_sso";
		Parameters: [params: OpenSsoParamsType, name: string, customCss?: string];
		ReturnType: OpenSsoReturnType;
		ResponseType: "promise";
	},
	/**
	 * Method to track an SSO session
	 * This is a one-shot request
	 */
	{
		Method: "frak_trackSso";
		Parameters: [params: TrackSsoParamsType];
		ReturnType: TrackSsoReturnType;
		ResponseType: "promise";
	},
	/**
	 * Method to get current product information's
	 *  - Is product minted?
	 *  - Does it have running campaign?
	 *  - Estimated reward on actions
	 * This is a one-shot request
	 */
	{
		Method: "frak_getProductInformation";
		Parameters?: undefined;
		ReturnType: GetProductInformationReturnType;
		ResponseType: "promise";
	},
	/**
	 * Method to show the embedded wallet, with potential customization
	 * This is a one-shot request
	 */
	{
		Method: "frak_displayEmbeddedWallet";
		Parameters: [
			request: DisplayEmbeddedWalletParamsType,
			metadata: FrakWalletSdkConfigMetadata,
		];
		ReturnType: DisplayEmbeddedWalletResultType;
		ResponseType: "promise";
	},
];

/**
 * Extract method names from the schema
 */
export type RpcMethod = IFrameRpcSchema[number]["Method"];

/**
 * Extract schema entry by method name
 */
export type RpcSchemaByMethod<TMethod extends RpcMethod> = Extract<
	IFrameRpcSchema[number],
	{ Method: TMethod }
>;

/**
 * Extract parameters for a specific method
 */
export type RpcParameters<TMethod extends RpcMethod> =
	RpcSchemaByMethod<TMethod>["Parameters"];

/**
 * Extract return type for a specific method
 */
export type RpcReturnType<TMethod extends RpcMethod> =
	RpcSchemaByMethod<TMethod>["ReturnType"];

/**
 * Extract response type for a specific method
 */
export type RpcResponseType<TMethod extends RpcMethod> =
	RpcSchemaByMethod<TMethod>["ResponseType"];

/**
 * Check if a method is a stream method
 */
export type IsStreamMethod<TMethod extends RpcMethod> =
	RpcResponseType<TMethod> extends "stream" ? true : false;

/**
 * Get all stream methods
 */
export type StreamMethods = {
	[K in RpcMethod]: IsStreamMethod<K> extends true ? K : never;
}[RpcMethod];

/**
 * Get all promise methods
 */
export type PromiseMethods = {
	[K in RpcMethod]: IsStreamMethod<K> extends false ? K : never;
}[RpcMethod];
