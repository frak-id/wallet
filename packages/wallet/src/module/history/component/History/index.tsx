"use client";

import { ArticleUnlock } from "@/module/history/component/ArticleUnlock";
import { FrkReceived } from "@/module/history/component/FrkReceived";
import { useGetHistory } from "@/module/history/hook/useGetHistory";

export function History() {
    const { history } = useGetHistory();

    return history?.map((historyItem) => (
        <div key={historyItem.txHash}>
            {historyItem.key === "article-unlock" && (
                <ArticleUnlock article={historyItem} />
            )}
            {historyItem.key === "frk-received" && (
                <FrkReceived frkReceived={historyItem} />
            )}
        </div>
    ));
}
