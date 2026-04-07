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
import type { SendInteractionParamsType } from "./rpc/interaction";
import type { GetMerchantInformationReturnType } from "./rpc/merchantInformation";
import type {
    OpenSsoParamsType,
    OpenSsoReturnType,
    PrepareSsoParamsType,
    PrepareSsoReturnType,
} from "./rpc/sso";
import type { UserReferralStatusType } from "./rpc/userReferralStatus";
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
 * - Params: [requests: {@link ModalRpcStepsInput}, metadata?: {@link ModalRpcMetadata}, configMetadata: {@link FrakWalletSdkConfig}["metadata"], placement?: string]
 * - Returns: {@link ModalRpcStepsResultType}
 * - Response Type: promise (one-shot)
 *
 * #### frak_sso
 *  - Params: [params: {@link OpenSsoParamsType}, name: string, customCss?: string]
 *  - Returns: {@link OpenSsoReturnType}
 *  - Response Type: promise (one-shot)
 *
 * #### frak_getMerchantInformation
 *  - Params: None
 *  - Returns: {@link GetMerchantInformationReturnType}
 *  - Response Type: promise (one-shot)
 *
 * #### frak_displayEmbeddedWallet
 * - Params: [request: {@link DisplayEmbeddedWalletParamsType}, metadata: {@link FrakWalletSdkConfig}["metadata"], placement?: string]
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
            placement?: string,
        ];
        ReturnType: ModalRpcStepsResultType;
    },
    /**
     * Method to prepare SSO (generate URL for popup)
     * Returns the SSO URL that should be opened in a popup
     * Only used for popup flows (not redirect flows)
     */
    {
        Method: "frak_prepareSso";
        Parameters: [
            params: PrepareSsoParamsType,
            name?: string,
            customCss?: string,
        ];
        ReturnType: PrepareSsoReturnType;
    },
    /**
     * Method to open/trigger SSO
     * Either triggers redirect (if openInSameWindow/redirectUrl)
     * Or waits for popup completion (if popup mode)
     * This method handles BOTH redirect and popup flows
     */
    {
        Method: "frak_openSso";
        Parameters: [
            params: OpenSsoParamsType,
            name?: string,
            customCss?: string,
        ];
        ReturnType: OpenSsoReturnType;
    },
    /**
     * Method to get current merchant information
     *  - Is merchant registered?
     *  - Does it have running campaign?
     *  - Estimated reward on actions
     * This is a one-shot request
     */
    {
        Method: "frak_getMerchantInformation";
        Parameters?: undefined;
        ReturnType: GetMerchantInformationReturnType;
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
            placement?: string,
        ];
        ReturnType: DisplayEmbeddedWalletResultType;
    },
    /**
     * Method to send interactions (arrival, sharing, custom events)
     * Fire-and-forget method - no return value expected
     * merchantId is resolved from context
     * clientId is passed via metadata as safeguard against race conditions
     */
    {
        Method: "frak_sendInteraction";
        Parameters: [
            interaction: SendInteractionParamsType,
            metadata?: { clientId?: string },
        ];
        ReturnType: undefined;
    },
    /**
     * Method to get the current user's referral status on this merchant.
     * Returns whether the user was referred (has a referral link as referee).
     * Returns null when the user's identity cannot be resolved.
     * This is a one-shot request.
     */
    {
        Method: "frak_getUserReferralStatus";
        Parameters?: undefined;
        ReturnType: UserReferralStatusType | null;
    },
];
