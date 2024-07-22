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
import type {
    StartArticleUnlockParams,
    StartArticleUnlockReturnType,
} from "./rpc/startUnlock";
import type { UnlockOptionsReturnType } from "./rpc/unlockOption";
import type { ArticleUnlockStatusReturnType } from "./rpc/unlockStatus";
import type { WalletStatusReturnType } from "./rpc/walletStatus";

/**
 * RPC interface that's used for the iframe communication
 */
export type IFrameRpcSchema = [
    /**
     * Method used to fetch an article unlock options
     */
    {
        Method: "frak_getArticleUnlockOptions";
        Parameters: [contentId: Hex, articleId: Hex];
        ReturnType: UnlockOptionsReturnType;
    },
    /**
     * Method used to listen to the wallet status
     */
    {
        Method: "frak_listenToWalletStatus";
        Parameters?: undefined;
        ReturnType: WalletStatusReturnType;
    },
    /**
     * Method used to listen to an article unlock status
     */
    {
        Method: "frak_listenToArticleUnlockStatus";
        Parameters: [contentId: Hex, articleId: Hex];
        ReturnType: ArticleUnlockStatusReturnType;
    },
    /**
     * Method to transmit a user interaction
     */
    {
        Method: "frak_displayModal";
        Parameters: [requests: ModalRpcStepsInput, metadata?: ModalRpcMetadata];
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

/**
 * RPC interface that's used for the redirection communication
 */
export type RedirectRpcSchema = [
    /**
     * Method used to start the unlock of an article
     */
    {
        Method: "frak_startArticleUnlock";
        Path: "/paywall";
        Parameters: StartArticleUnlockParams;
        ReturnType: StartArticleUnlockReturnType;
    },
];
