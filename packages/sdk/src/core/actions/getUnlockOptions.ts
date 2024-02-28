import type { Hex } from "viem";
import type { FrakClient } from "../types/client.ts";

/**
 * Type used to get the unlock options
 */
type GetUnlockOptionsParams = {
    articleId: Hex;
};

/**
 * Function used to fetch the unlock option for the given client
 * @param client
 * @param articleId
 */
export function getArticleUnlockOptions(
    client: FrakClient,
    { articleId }: GetUnlockOptionsParams
) {
    return client.request({
        method: "frak_getArticleUnlockOptions",
        params: [client.config.contentId, articleId],
    });
}
