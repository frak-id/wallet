"use client";

import { PolygonLink } from "@/module/wallet/component/PolygonLink";
import type { ArticleUnlock as ArticleUnlockType } from "@/types/HistoryItem";
// import { ExternalLink } from "lucide-react";
import styles from "./index.module.css";

type ArticleUnlockProps = {
    article: ArticleUnlockType;
};

export function ArticleUnlock({ article }: ArticleUnlockProps) {
    return (
        <div className={styles.articleUnlock}>
            <h2 className={styles.articleUnlock__title}>Unlocked article</h2>
            <p>Expire in: {article.remainingTimeFormatted}</p>
            <p>
                Transaction: <PolygonLink hash={article.txHash} />
            </p>
            {/*<p>
                <a href={`/article/${article.articleId}`}>
                    Read it <ExternalLink size={16} />
                </a>
            </p>*/}
        </div>
    );
}
