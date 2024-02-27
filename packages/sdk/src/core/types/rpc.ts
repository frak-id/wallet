import type { Hex } from "viem";
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
];
