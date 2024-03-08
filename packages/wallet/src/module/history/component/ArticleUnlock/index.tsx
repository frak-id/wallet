"use client";

import { Timer } from "@/assets/icons/Timer";
import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { AlertDialogArticle } from "@/module/history/component/AlertDialogArticle";
import { DrawerArticle } from "@/module/history/component/DrawerArticle";
import type { ArticleUnlockWithFrontData } from "@/types/HistoryItem";
import { useMediaQuery } from "@uidotdev/usehooks";
import styles from "./index.module.css";

type ArticleUnlockProps = {
    article: ArticleUnlockWithFrontData;
};

export function ArticleUnlock({ article }: ArticleUnlockProps) {
    const stillAllowedClassName = article.isStillAllowed
        ? styles.articleUnlock__isAllowed
        : styles.articleUnlock__isNotAllowed;

    // Check if the screen is desktop or mobile
    const isDesktop = useMediaQuery("(min-width : 600px)");

    // Use a Drawer for mobile and an AlertDialog for desktop
    const Component = isDesktop ? AlertDialogArticle : DrawerArticle;
    // console.log(article);

    const ImageFallback = (
        <span
            className={`${styles.articleUnlock__image} ${styles["articleUnlock__image--fallback"]}`}
        />
    );

    return (
        <Component
            trigger={
                <Panel size={"small"}>
                    <Title
                        icon={ImageFallback}
                        className={styles.articleUnlock__title}
                    >
                        <span className={styles.articleUnlock__provider}>
                            Le Monde
                        </span>
                        <br />
                        <span>{article.articleTitle}</span>
                    </Title>
                    <Row
                        withIcon={true}
                        className={styles.articleUnlock__timer}
                    >
                        <Timer />{" "}
                        <span className={stillAllowedClassName}>
                            {article.remainingTimeFormatted ?? "Expired"}
                        </span>
                    </Row>
                </Panel>
            }
        >
            <>
                <Title
                    icon={ImageFallback}
                    className={styles.articleUnlock__title}
                >
                    <span className={styles.articleUnlock__provider}>
                        Le Monde
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
                    Unlocked for {article.paidAmount} FRK at{" "}
                    {new Date(article.txDate).toLocaleString()}
                </Row>
                {article.remainingTimeFormatted && (
                    <Row>Time remaining: {article.remainingTimeFormatted}</Row>
                )}
                {/*<Row>User Op: 0xAbC...DeF</Row>*/}
                {/*<Row withIcon={true}>
                    Tx: <PolygonLink hash={article.txHash} />
                </Row>*/}
            </>
        </Component>
    );
}
