"use client";

import { Skeleton } from "@/module/common/component/Skeleton";
import { ArticleUnlock } from "@/module/history/component/ArticleUnlock";
import { useGetUnlockHistory } from "@/module/history/hook/useGetUnlockHistory";

export function UnlockHistory() {
    const { history } = useGetUnlockHistory();

    if (!history) return <Skeleton count={3} height={110} />;

    return history?.map((historyItem) => (
        <ArticleUnlock key={historyItem.txHash} article={historyItem} />
    ));
}
