"use client";

import { ArticleUnlock } from "@/module/history/component/ArticleUnlock";
import { FrkReceived } from "@/module/history/component/FrkReceived";
import { useGetHistory } from "@/module/history/hook/useGetHistory";
import { Fragment } from "react";

export function History() {
    const { history } = useGetHistory();

    return history?.map((historyItem) => (
        <Fragment key={historyItem.txHash}>
            {historyItem.key === "article-unlock" && (
                <ArticleUnlock article={historyItem} />
            )}
            {historyItem.key === "frk-received" && (
                <FrkReceived frkReceived={historyItem} />
            )}
        </Fragment>
    ));
}
