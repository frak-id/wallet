"use client";

import { dexieDb } from "@/context/common/dexie/dexieDb";
import { getInteractionHistory } from "@/context/history/action/interactionHistory";
import type { InteractionHistoryWithFrontData } from "@/types/InteractionHistory";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

// Fetch the current wallet history
export function useGetInteractionHistory() {
    const { address } = useAccount();

    // The query fn that will fetch the history
    const { data: history } = useQuery({
        queryKey: ["history", "interaction", address],
        queryFn: async () => {
            const rawHistory = await getInteractionHistory({
                account: address ?? "0x",
            });

            // Fetch every frontend data we have in the dexie db
            const articleInfos = await dexieDb.articleInfo.toArray();

            // Map every interaction with the front data
            return rawHistory.map((item) => {
                // Try to find it inside our frontend data
                const articleInfo = articleInfos.find(
                    (info) => BigInt(info.contentId) === BigInt(item.contentId)
                );

                return {
                    ...item,
                    articleUrl: articleInfo?.articleUrl,
                    articleTitle: articleInfo?.articleTitle,
                    contentTitle: articleInfo?.contentTitle,
                    provider: articleInfo?.provider,
                };
            }) as InteractionHistoryWithFrontData[];
        },
        enabled: !!address,
    });

    return {
        history,
    };
}
