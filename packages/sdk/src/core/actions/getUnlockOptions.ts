import type { Hex } from "viem";
import type { NexusClient } from "../types/client";

/**
 * Type used to get the unlock options
 */
export type GetUnlockOptionsParams = {
    articleId: Hex;
};

/**
 * Function used to fetch the unlock option for the given client
 * @param client
 * @param articleId
 */
export function getArticleUnlockOptions(
    client: NexusClient,
    { articleId }: GetUnlockOptionsParams
) {
    return client.request({
        method: "frak_getArticleUnlockOptions",
        params: [client.config.contentId, articleId],
    });
}
