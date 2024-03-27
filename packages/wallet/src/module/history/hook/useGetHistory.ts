"use client";

import { dexieDb } from "@/context/common/dexie/dexieDb";
import { fetchWalletHistory } from "@/context/history/action/fetchHistory";
import type { HistoryItemWithFrontData } from "@/types/HistoryItem";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useChainId } from "wagmi";

// Fetch the current wallet history
export function useGetHistory() {
    const { address } = useAccount();
    const chainId = useChainId();

    // The query fn that will fetch the history
    // TODO: Should populate the history with the article and content link we have in the dexie db
    const { data: history } = useQuery({
        queryKey: ["history", address],
        queryFn: async () => {
            const rawHistory = await fetchWalletHistory({
                account: address ?? "0x",
                chainId,
            });

            // Fetch every frontend data we have in the dexie db
            // TODO: Should use a bulk get here, but would imply a small rewrite of the DTO to have a hash or a bigint has key
            const articleInfos = await dexieDb.articleInfo.toArray();

            // Map every article unlock with the front data
            return rawHistory.map((item) => {
                // If that's not an article unlock, we don't need to do anything
                if (item.key !== "article-unlock") {
                    return item;
                }

                // Try to find it inside our frontend data
                const articleInfo = articleInfos.find(
                    (info) =>
                        info.articleId === item.articleId &&
                        BigInt(info.contentId) === BigInt(item.contentId)
                );

                return {
                    ...item,
                    articleUrl: articleInfo?.articleUrl,
                    articleTitle: articleInfo?.articleTitle,
                    contentTitle: articleInfo?.contentTitle,
                    provider: articleInfo?.provider,
                };
            }) as HistoryItemWithFrontData[];
        },
        enabled: !!address,
    });

    return {
        history,
    };
}
