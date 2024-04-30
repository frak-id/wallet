import type { Hex } from "viem";
import type { NexusClient } from "../types/client";

/**
 * Type used to get the unlock options
 */
export type GetUnlockOptionsParams = {
    articleId: Hex;
    contentId: Hex;
};

/**
 * Function used to fetch the unlock option for the given client
 * @param client
 * @param articleId
 * @param contentId
 */
export function getArticleUnlockOptions(
    client: NexusClient,
    { articleId, contentId }: GetUnlockOptionsParams
) {
    return client.request({
        method: "frak_getArticleUnlockOptions",
        params: [contentId, articleId],
    });
}
