"use client";

// import { ExternalLink } from "lucide-react";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { PolygonLink } from "@/module/wallet/component/PolygonLink";
import type { ArticleUnlock as ArticleUnlockType } from "@/types/HistoryItem";

type ArticleUnlockProps = {
    article: ArticleUnlockType;
};

export function ArticleUnlock({ article }: ArticleUnlockProps) {
    return (
        <Panel>
            <Title>Unlocked article</Title>
            <p>Expire in: {article.remainingTimeFormatted}</p>
            <p>
                Transaction: <PolygonLink hash={article.txHash} />
            </p>
            {/*<p>
                <a href={`/article/${article.articleId}`}>
                    Read it <ExternalLink size={16} />
                </a>
            </p>*/}
        </Panel>
    );
}
