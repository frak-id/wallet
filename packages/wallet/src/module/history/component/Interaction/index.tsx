"use client";

import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import type { InteractionHistory } from "@/types/InteractionHistory";
import { BookText, Forward, MailOpen, Link } from "lucide-react";
import styles from "./index.module.css";

type InteractionProps = {
    article: InteractionHistory;
};

const mapLabels = {
    OPEN_ARTICLE: "Opened article",
    READ_ARTICLE: "Read article",
    REFERRED: "Referred",
    CREATE_REFERRAL_LINK: "Create share link",
};

const mapIcons = {
    OPEN_ARTICLE: <MailOpen size={30} />,
    READ_ARTICLE: <BookText size={30} />,
    REFERRED: <Forward size={30} />,
    CREATE_REFERRAL_LINK: <Link size={30} />,
};

export function Interaction({ article }: InteractionProps) {
    return (
        <Panel size={"small"} className={styles.interaction__panel}>
            <Title
                icon={mapIcons[article.type]}
                className={styles.interaction__title}
                classNameText={styles.interaction__titleText}
            >
                <span className={styles.interaction__provider}>
                    {mapLabels[article.type]}
                </span>
                at {new Date(article.timestamp * 1000).toLocaleString()}
            </Title>
        </Panel>
    );
}
