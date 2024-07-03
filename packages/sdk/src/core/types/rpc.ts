import type { Hex } from "viem";
import type {
    SiweAuthenticateReturnType,
    SiweAuthenticationParams,
} from "./rpc/authenticate";
import type {
    PreparedInteraction,
    SendInteractionReturnType,
} from "./rpc/interaction";
import type {
    SendTransactionReturnType,
    SendTransactionRpcParamsType,
} from "./rpc/sendTransaction";
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
     * Method to ask the user to send a transaction
     */
    {
        Method: "frak_sendTransaction";
        Parameters: SendTransactionRpcParamsType;
        ReturnType: SendTransactionReturnType;
    },
    /**
     * Method to ask the user for a strong authentication
     */
    {
        Method: "frak_siweAuthenticate";
        Parameters: [request: SiweAuthenticationParams, context?: string];
        ReturnType: SiweAuthenticateReturnType;
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
