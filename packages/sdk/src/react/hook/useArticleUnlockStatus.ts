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
 * Hooks used to listen to the current article unlock status
 */
export function useArticleUnlockStatus({
    articleId,
    contentId,
}: WatchUnlockStatusParams) {
    const queryClient = useQueryClient();
    const client = useNexusClient();

    /**
     * Callback hook when we receive an updated article unlock status
     */
    const newStatusUpdated = useCallback(
        (event: ArticleUnlockStatusReturnType) => {
            queryClient.setQueryData(
                [
                    "nexus-sdk",
                    "article-unlock-status",
                    articleId ?? "no-article-id",
                    contentId ?? "no-contentId-id",
                ],
                event
            );
        },
        [articleId, contentId, queryClient]
    );

    /**
     * Setup the query listener
     */
    return useQuery<ArticleUnlockStatusQueryReturnType | null>({
        queryKey: [
            "nexus-sdk",
            "article-unlock-status",
            articleId ?? "no-article-id",
            contentId ?? "no-contentId-id",
        ],
        gcTime: 0,
        queryFn: async () => {
            if (!client) {
                return {
                    status: "waiting-response",
                    key: "waiting-response",
                };
            }
            if (!(articleId && contentId)) {
                return null;
            }
            // Setup the listener
            await watchUnlockStatus(
                client,
                { articleId, contentId },
                newStatusUpdated
            );
            // Wait for the first response
            return {
                status: "waiting-response",
                key: "waiting-response",
            };
        },
        enabled: !!client && !!articleId && !!contentId,
    });
}
