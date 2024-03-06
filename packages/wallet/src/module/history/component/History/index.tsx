"use client";

import { Skeleton } from "@/module/common/component/Skeleton";
import { ArticleUnlock } from "@/module/history/component/ArticleUnlock";
import { FrkReceived } from "@/module/history/component/FrkReceived";
import { FrkSent } from "@/module/history/component/FrkSent";
import { useGetHistory } from "@/module/history/hook/useGetHistory";
import { Fragment } from "react";

export function History() {
    const { history } = useGetHistory();

    if (!history) return <Skeleton />;

    return history?.map((historyItem) => (
        <Fragment key={`${historyItem.key} ${historyItem.txHash}`}>
            {historyItem.key === "article-unlock" && (
                <ArticleUnlock article={historyItem} />
            )}
            {historyItem.key === "frk-received" && (
                <FrkReceived frkReceived={historyItem} />
            )}
            {historyItem.key === "frk-sent" && (
                <FrkSent frkSent={historyItem} />
            )}
        </Fragment>
    ));
}
