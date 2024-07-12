"use client";

import { Panel } from "@/module/common/component/Panel";
import Row from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import { AlertDialogArticle } from "@/module/history/component/AlertDialogArticle";
import { DrawerArticle } from "@/module/history/component/DrawerArticle";
import type { InteractionHistoryWithFrontData } from "@/types/InteractionHistory";
import { useMediaQuery } from "@module/hook/useMediaQuery";
import { BookText } from "lucide-react";
import Image from "next/image";
import styles from "./index.module.css";

type InteractionProps = {
    article: InteractionHistoryWithFrontData;
};

const mapLabels = {
    OPEN_ARTICLE: "Opened article",
    READ_ARTICLE: "Read article",
    REFERRED: "Referred",
};

export function Interaction({ article }: InteractionProps) {
    // Check if the screen is desktop or mobile
    const isDesktop = useMediaQuery("(min-width : 600px)");

    // Use a Drawer for mobile and an AlertDialog for desktop
    const Component = isDesktop ? AlertDialogArticle : DrawerArticle;

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
                        className={styles.interaction__title}
                        classNameText={styles.interaction__titleText}
                    >
                        <span>{article.provider?.name}</span>
                        <span>{article.articleTitle}</span>
                    </Title>
                    <Row className={styles.interaction__text}>
                        <span className={styles.interaction__provider}>
                            {mapLabels[article.type]}
                        </span>
                    </Row>
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
                                className={styles.interaction__image}
                            />
                        ) : (
                            <BookText size={30} />
                        )
                    }
                    className={styles.interaction__title}
                    classNameText={styles.interaction__titleText}
                >
                    <span className={styles.interaction__provider}>
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
                    </a>
                </Row>
                <Row>
                    <span className={styles.interaction__provider}>
                        {mapLabels[article.type]}
                    </span>
                </Row>
            </>
        </Component>
    );
}
