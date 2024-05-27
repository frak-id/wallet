"use client";

import { Timer } from "@/assets/icons/Timer";
import { formatSecondDuration } from "@/context/common/duration";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { useConvertToEuro } from "@/module/common/hook/useConvertToEuro";
import { AlertDialogArticle } from "@/module/history/component/AlertDialogArticle";
import { DrawerArticle } from "@/module/history/component/DrawerArticle";
import type { ArticleUnlockWithFrontData } from "@/types/HistoryItem";
import { useMediaQuery } from "@uidotdev/usehooks";
import { BookText } from "lucide-react";
import Image from "next/image";
import styles from "./index.module.css";

type ArticleUnlockProps = {
    article: ArticleUnlockWithFrontData;
};

export function ArticleUnlock({ article }: ArticleUnlockProps) {
    // Convert the paid amount to euro
    const { convertToEuro } = useConvertToEuro();

    // Check if the screen is desktop or mobile
    const isDesktop = useMediaQuery("(min-width : 600px)");

    // Use a Drawer for mobile and an AlertDialog for desktop
    const Component = isDesktop ? AlertDialogArticle : DrawerArticle;

    const timeExpired =
        !article.remainingTimeFormatted &&
        formatSecondDuration(
            (Date.now() - new Date(article.allowedUntil).getTime()) / 1000
        );

    return (
        <Component
            trigger={
                <Panel size={"small"}>
                    <Title
                        icon={
                            article.provider?.imageUrl ? (
                                <img
                                    src={article.provider?.imageUrl}
                                    width={"30"}
                                    height={"30"}
                                    alt={article.provider?.name}
                                    className={styles.articleUnlock__image}
                                />
                            ) : (
                                <BookText size={30} />
                            )
                        }
                        className={styles.articleUnlock__title}
                        classNameText={styles.articleUnlock__titleText}
                    >
                        <span className={styles.articleUnlock__provider}>
                            {article.provider?.name}
                        </span>
                        <span>{article.articleTitle}</span>
                    </Title>
                    {article.remainingTimeFormatted && (
                        <Row
                            withIcon={true}
                            className={styles.articleUnlock__timer}
                        >
                            <Timer />{" "}
                            <span className={styles.articleUnlock__isAllowed}>
                                {article.remainingTimeFormatted}
                            </span>
                        </Row>
                    )}
                    {!article.remainingTimeFormatted && (
                        <Row className={styles.articleUnlock__timer}>
                            Expired:{" "}
                            <span
                                className={styles.articleUnlock__isNotAllowed}
                            >
                                {timeExpired}
                            </span>
                        </Row>
                    )}
                </Panel>
            }
        >
            <>
                <Title
                    icon={
                        article.provider?.imageUrl ? (
                            <Image
                                src={article.provider?.imageUrl}
                                width={"30"}
                                height={"30"}
                                alt={article.provider?.name}
                                className={styles.articleUnlock__image}
                            />
                        ) : (
                            <BookText size={30} />
                        )
                    }
                    className={styles.articleUnlock__title}
                    classNameText={styles.articleUnlock__titleText}
                >
                    <span className={styles.articleUnlock__provider}>
                        {article.provider?.name}
                    </span>
                </Title>
                <Row>
                    <a
                        href={article.articleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {article.articleTitle}
                        {/*<ExternalLink />*/}
                    </a>
                </Row>
                {/*<a
                    href={article.articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.articleUnlock__link}
                >
                    <ExternalLink/>
                </a>*/}
                {/*<Row>
                    Content: {article.contentTitle} (id: {article.contentId})
                </Row>*/}
                {/*<Row>
                    Article Id:{" "}
                    <PolygonLink hash={article.articleId} icon={false} />
                </Row>*/}
                <Row>
                    Unlocked for {convertToEuro(article.paidAmount, "FRK")} at{" "}
                    {new Date(article.txDate).toLocaleString()}
                </Row>
                {article.remainingTimeFormatted && (
                    <Row>Time remaining: {article.remainingTimeFormatted}</Row>
                )}
                {/*<Row>User Op: 0xAbC...DeF</Row>*/}
                {/*<Row withIcon={true}>
                    Tx: <PolygonLink hash={article.txHash} />
                </Row>*/}
                {timeExpired && (
                    <Row>
                        Expired:{" "}
                        <span className={styles.articleUnlock__isNotAllowed}>
                            {timeExpired}
                        </span>
                    </Row>
                )}
            </>
        </Component>
    );
}
