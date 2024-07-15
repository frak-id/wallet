"use client";

import { dexieDb } from "@/context/common/dexie/dexieDb";
import { getUnlockHistory } from "@/context/history/action/unlockHistory";
import type { ArticleUnlockHistoryWithFrontData } from "@/types/ArticleUnlockHistory";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useChainId } from "wagmi";

// Fetch the current wallet history
export function useGetUnlockHistory() {
    const { address } = useAccount();
    const chainId = useChainId();

    // The query fn that will fetch the history
    const { data: history } = useQuery({
        queryKey: ["history", "unlock", address, chainId],
        queryFn: async () => {
            const rawHistory = await getUnlockHistory({
                account: address ?? "0x",
                chainId,
            });

            // Fetch every frontend data we have in the dexie db
            const articleInfos = await dexieDb.articleInfo.toArray();

            // Map every article unlock with the front data
            return rawHistory.map((item) => {
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
            }) as ArticleUnlockHistoryWithFrontData[];
        },
        enabled: !!address && !!chainId,
    });

    return {
        history,
    };
}
