import type { Hex } from "viem";
import type { NexusClient } from "../types/client";
import type { ArticleUnlockStatusReturnType } from "../types/rpc/unlockStatus";

/**
 * Type used to get the unlock options
 */
type WatchUnlockStatusParams = {
    articleId: Hex;
};

/**
 * Function used to watch a current article unlock status
 * @param client
 * @param articleId
 * @param callback
 */
export function watchUnlockStatus(
    client: NexusClient,
    { articleId }: WatchUnlockStatusParams,
    callback: (status: ArticleUnlockStatusReturnType) => void
) {
    return client.listenerRequest(
        {
            method: "frak_listenToArticleUnlockStatus",
            params: [client.config.contentId, articleId],
        },
        callback
    );
}
