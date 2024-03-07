import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ArticleUnlockStatusReturnType } from "../../core";
import {
    type WatchUnlockStatusParams,
    watchUnlockStatus,
} from "../../core/actions";
import { useNexusClient } from "./useNexusClient";

export type ArticleUnlockStatusQueryReturnType =
    | ArticleUnlockStatusReturnType
    | {
          status: "waiting-response";
          key: "waiting-response";
      };

/**
 * Hooks used to listen to the current wallet status
 */
export function useArticleUnlockStatus({ articleId }: WatchUnlockStatusParams) {
    const queryClient = useQueryClient();
    const client = useNexusClient();

    /**
     * Callback hook when we receive an updated article unlock status
     */
    const newStatusUpdated = useCallback(
        (event: ArticleUnlockStatusReturnType) => {
            queryClient.setQueryData(
                ["articleUnlockStatusListener", articleId ?? "no-article-id"],
                event
            );
        },
        [articleId, queryClient]
    );

    /**
     * Setup the query listener
     */
    return useQuery<ArticleUnlockStatusQueryReturnType>({
        queryKey: ["articleUnlockStatusListener", articleId ?? "no-article-id"],
        queryFn: async () => {
            // Setup the listener
            await watchUnlockStatus(client, { articleId }, newStatusUpdated);
            // Wait for the first response
            return {
                status: "waiting-response",
                key: "waiting-response",
            };
        },
        enabled: !!articleId,
    });
}
