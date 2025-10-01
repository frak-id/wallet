import type { Hex } from "viem";
import type { FrakWalletSdkConfig } from "./config";
import type {
    ModalRpcMetadata,
    ModalRpcStepsInput,
    ModalRpcStepsResultType,
} from "./rpc/displayModal";
import type {
    DisplayEmbeddedWalletParamsType,
    DisplayEmbeddedWalletResultType,
} from "./rpc/embedded";
import type {
    PreparedInteraction,
    SendInteractionReturnType,
} from "./rpc/interaction";
import type { GetProductInformationReturnType } from "./rpc/productInformation";
import type { OpenSsoParamsType, OpenSsoReturnType } from "./rpc/sso";
import type { WalletStatusReturnType } from "./rpc/walletStatus";

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
 * - Params: [requests: {@link ModalRpcStepsInput}, metadata?: {@link ModalRpcMetadata}, configMetadata: {@link FrakWalletSdkConfig}["metadata"]]
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
 * #### frak_getProductInformation
 *  - Params: None
 *  - Returns: {@link GetProductInformationReturnType}
 *  - Response Type: promise (one-shot)
 *
 * #### frak_displayEmbeddedWallet
 * - Params: [request: {@link DisplayEmbeddedWalletParamsType}, metadata: {@link FrakWalletSdkConfig}["metadata"]]
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
            configMetadata: FrakWalletSdkConfig["metadata"],
        ];
        ReturnType: ModalRpcStepsResultType;
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
    },
    /**
     * Method to start a SSO
     * This is a one-shot request
     */
    {
        Method: "frak_sso";
        Parameters: [
            params: OpenSsoParamsType,
            name: string,
            customCss?: string,
        ];
        ReturnType: OpenSsoReturnType;
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
    },
    /**
     * Method to show the embedded wallet, with potential customization
     * This is a one-shot request
     */
    {
        Method: "frak_displayEmbeddedWallet";
        Parameters: [
            request: DisplayEmbeddedWalletParamsType,
            metadata: FrakWalletSdkConfig["metadata"],
        ];
        ReturnType: DisplayEmbeddedWalletResultType;
    },
];
