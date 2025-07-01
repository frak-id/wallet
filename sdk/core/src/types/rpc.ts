import type { Address, Hex } from "viem";
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
import type { OpenSsoParamsType } from "./rpc/sso";
import type { WalletStatusReturnType } from "./rpc/walletStatus";

/**
 * RPC interface that's used for the iframe communication
 *
 * Define all the methods available within the iFrame RPC client
 *
 * @group RPC Schema
 *
 * @remarks
 * Here is the list of methods available:
 *
 * ### frak_listenToWalletStatus
 *  - Params: None
 *  - Returns: {@link WalletStatusReturnType}
 *
 * ### frak_displayModal
 * - Params: [{@link ModalRpcStepsInput}, name: string, metadata?: {@link ModalRpcMetadata}]
 * - Returns: {@link ModalRpcStepsResultType}
 *
 * ### frak_sendInteraction
 *  - Params: [productId: Hex, interaction: {@link PreparedInteraction}, signature?: Hex, campaignId?: Address]
 *  - Returns: {@link SendInteractionReturnType}
 *
 * ### frak_sso
 *  - Params [params: {@link OpenSsoParamsType}, name: string, customCss?: string]
 *  - Returns: undefined
 *
 *  ### frak_getProductInformation
 *  - Params: None
 *  - Returns: {@link GetProductInformationReturnType}
 *
 * ### frak_displayEmbeddedWallet
 * - Params: [{@link DisplayEmbeddedWalletParamsType}]
 * - Returns: {@link DisplayEmbeddedWalletResultType}
 */
export type IFrameRpcSchema = [
    /**
     * Method used to listen to the wallet status
     */
    {
        Method: "frak_listenToWalletStatus";
        Parameters?: undefined;
        ReturnType: WalletStatusReturnType;
    },
    /**
     * Method to display a modal with the provided steps
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
     */
    {
        Method: "frak_sendInteraction";
        Parameters: [
            productId: Hex,
            interaction: PreparedInteraction,
            signature?: Hex,
            campaignId?: Address,
        ];
        ReturnType: SendInteractionReturnType;
    },
    /**
     * Method to start a SSO
     *  todo: Should also support direct tracking via a consumeKey
     */
    {
        Method: "frak_sso";
        Parameters: [
            params: OpenSsoParamsType,
            name: string,
            customCss?: string,
        ];
        ReturnType: undefined;
    },
    /**
     * Method to get current product information's
     *  - Is product minted?
     *  - Does it have running campaign?
     *  - Estimated reward on actions
     */
    {
        Method: "frak_getProductInformation";
        Parameters?: undefined;
        ReturnType: GetProductInformationReturnType;
    },
    /**
     * Method to show the embedded wallet, with potential customization
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
