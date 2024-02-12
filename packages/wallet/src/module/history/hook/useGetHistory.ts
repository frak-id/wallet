"use client";

import { dexieDb } from "@/context/common/dexie/dexieDb";
import { fetchWalletHistory } from "@/context/history/action/fetchHistory";
import type {
    ArticleUnlock,
    HistoryItemWithFrontData,
} from "@/types/HistoryItem";
import { useQuery } from "@tanstack/react-query";
import { sift } from "radash";
import { useAccount } from "wagmi";

// Fetch the current wallet history
export function useGetHistory() {
    const { address } = useAccount();

    // The query fn that will fetch the history
    // TODO: Should populate the history with the article and content link we have in the dexie db
    const {
        data: history,
        isPending: isLoading,
        isSuccess,
        isError,
        refetch,
    } = useQuery({
        queryKey: ["history", address],
        queryFn: async () => {
            const rawHistory = await fetchWalletHistory({
                account: address ?? "0x",
            });

            // Fetch every frontend data we have in the dexie db
            const articleHistoryItems = rawHistory.filter(
                (item) => item.key === "article-unlock"
            ) as ArticleUnlock[];
            const articleInfos = sift(
                await dexieDb.articleInfo.bulkGet(
                    articleHistoryItems.map((item: ArticleUnlock) => ({
                        articleId: item.articleId,
                        contentId: item.contentId,
                    }))
                )
            );

            // Map every article unlock with the front data
            const history = rawHistory.map((item) => {
                // If that's not an article unlock, we don't need to do anything
                if (item.key !== "article-unlock") {
                    return item;
                }

                // Try to find it inside our frontend data
                const articleInfo = articleInfos.find(
                    (info) =>
                        info.articleId === item.articleId &&
                        BigInt(info.contentId) === item.contentId
                );

                return {
                    ...item,
                    articleUrl: articleInfo?.articleUrl,
                    articleTitle: articleInfo?.articleTitle,
                    contentTitle: articleInfo?.contentTitle,
                };
            }) as HistoryItemWithFrontData[];

            return history;
        },
        enabled: !!address,
    });

    return {
        history,
        isLoading,
        isSuccess,
        isError,
        refetch,
    };
}
