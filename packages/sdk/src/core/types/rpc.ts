import type { Hex } from "viem";
import type {
    ModalRpcMetadata,
    ModalRpcStepsInput,
    ModalRpcStepsResultType,
} from "./rpc/displayModal";
import type {
    PreparedInteraction,
    SendInteractionReturnType,
} from "./rpc/interaction";
import type { OpenSsoParamsType } from "./rpc/sso";
import type { WalletStatusReturnType } from "./rpc/walletStatus";

/**
 * RPC interface that's used for the iframe communication
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
     * Method to transmit a user interaction
     */
    {
        Method: "frak_displayModal";
        Parameters: [
            requests: ModalRpcStepsInput,
            name: string,
            metadata?: ModalRpcMetadata,
        ];
        ReturnType: ModalRpcStepsResultType;
    },
    /**
     * Method to transmit a user interaction
     */
    {
        Method: "frak_sendInteraction";
        Parameters: [
            contentId: Hex,
            interaction: PreparedInteraction,
            signature?: Hex,
        ];
        ReturnType: SendInteractionReturnType;
    },
    /**
     * Method to start a SSO
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
];
