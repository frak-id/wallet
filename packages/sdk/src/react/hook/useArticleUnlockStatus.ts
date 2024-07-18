import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
    type ArticleUnlockStatusReturnType,
    FrakRpcError,
    RpcErrorCodes,
} from "../../core";
import {
    type WatchUnlockStatusParams,
    watchUnlockStatus,
} from "../../core/actions";
import { ClientNotFound } from "../../core/types/rpc/error";
import { Deferred } from "../../core/utils/Deferred";
import { useNexusClient } from "./useNexusClient";

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
    return useQuery<ArticleUnlockStatusReturnType>({
        queryKey: [
            "nexus-sdk",
            "article-unlock-status",
            articleId ?? "no-article-id",
            contentId ?? "no-contentId-id",
        ],
        gcTime: 0,
        queryFn: async () => {
            if (!client) {
                throw new ClientNotFound();
            }
            if (!(articleId && contentId)) {
                throw new FrakRpcError(
                    RpcErrorCodes.invalidRequest,
                    "Missing articleId or contentId"
                );
            }

            // Our first deffered result
            const firstResult = new Deferred<ArticleUnlockStatusReturnType>();
            let hasResolved = false;

            // Setup the listener
            await watchUnlockStatus(
                client,
                { articleId, contentId },
                (status) => {
                    newStatusUpdated(status);
                    // If the promise hasn't resolved yet, resolve it
                    if (!hasResolved) {
                        firstResult.resolve(status);
                        hasResolved = true;
                    }
                }
            );

            // Wait for the first response
            return firstResult.promise;
        },
        enabled: !!client && !!articleId && !!contentId,
    });
}
