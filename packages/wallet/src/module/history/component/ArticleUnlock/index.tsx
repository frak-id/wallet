"use client";

import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { AccordionArticle } from "@/module/history/component/AccordionArticle";
import { PolygonLink } from "@/module/wallet/component/PolygonLink";
import type { ArticleUnlockWithFrontData } from "@/types/HistoryItem";
import { BookText, ExternalLink, Hourglass } from "lucide-react";
import styles from "./index.module.css";

type ArticleUnlockProps = {
    article: ArticleUnlockWithFrontData;
};

export function ArticleUnlock({ article }: ArticleUnlockProps) {
    const stillAllowedClassName = article.isStillAllowed
        ? styles["articleUnlock--isAllowed"]
        : styles["articleUnlock--isNotAllowed"];

    return (
        <Panel>
            <Title icon={<BookText />}>{article.articleTitle}</Title>
            <Row withIcon={true}>
                <Hourglass />{" "}
                <span className={stillAllowedClassName}>
                    {article.remainingTimeFormatted ?? "Expired"}
                </span>
                <a
                    href={article.articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.articleUnlock__link}
                >
                    <ExternalLink />
                </a>
            </Row>
            <AccordionArticle>
                <Row>
                    Content: {article.contentTitle} (id: {article.contentId})
                </Row>
                <Row>
                    Article Id:{" "}
                    <PolygonLink hash={article.articleId} icon={false} />
                </Row>
                <Row>
                    Unlock: {article.paidAmount} FRK for{" "}
                    {article.remainingTimeFormatted}
                </Row>
                <Row>At: {new Date(article.txDate).toLocaleString()}</Row>
                {/*<Row>User Op: 0xAbC...DeF</Row>*/}
                <Row withIcon={true}>
                    Tx: <PolygonLink hash={article.txHash} />
                </Row>
            </AccordionArticle>
        </Panel>
    );
}
