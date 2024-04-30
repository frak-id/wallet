import { useQuery } from "@tanstack/react-query";
import {
    type GetUnlockOptionsParams,
    getArticleUnlockOptions,
} from "../../core/actions";
import { useNexusClient } from "./useNexusClient";

/**
 * Hook used to get the unlock options for an article
 */
export function useArticleUnlockOptions({
    articleId,
    contentId,
}: GetUnlockOptionsParams) {
    const client = useNexusClient();

    return useQuery({
        queryKey: ["articleUnlockOptions", articleId ?? "no-article-id"],
        queryFn: async () => {
            if (!(articleId && contentId)) {
                throw new Error("No article id provided");
            }

            return await getArticleUnlockOptions(client, {
                articleId,
                contentId,
            });
        },
        enabled: !!articleId && !!contentId,
        gcTime: 0,
    });
}
