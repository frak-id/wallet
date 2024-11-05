import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import type { InteractionHistory } from "@/types/InteractionHistory";
import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

type InteractionProps = {
    article: InteractionHistory;
};

export function Interaction({ article }: InteractionProps) {
    const { t } = useTranslation();

    return (
        <Panel size={"small"}>
            <Title className={styles.interaction__title}>
                {article.productName} -{" "}
                {t(`wallet.interaction.${article.type}`)}
            </Title>
            <span className={styles.interaction__date}>
                {new Date(article.timestamp * 1000).toLocaleString()}
            </span>
        </Panel>
    );
}
