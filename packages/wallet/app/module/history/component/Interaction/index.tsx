import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import type { InteractionHistory } from "@/types/InteractionHistory";
import {
    BookText,
    Forward,
    Link,
    MailOpen,
    ShoppingBasket,
    ShoppingCart,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

type InteractionProps = {
    article: InteractionHistory;
};

const mapIcons = {
    OPEN_ARTICLE: <MailOpen size={30} />,
    READ_ARTICLE: <BookText size={30} />,
    REFERRED: <Forward size={30} />,
    CREATE_REFERRAL_LINK: <Link size={30} />,
    PURCHASE_STARTED: <ShoppingBasket size={30} />,
    PURCHASE_COMPLETED: <ShoppingCart size={30} />,
    WEBSHOP_OPENNED: <ShoppingCart size={30} />,
};

export function Interaction({ article }: InteractionProps) {
    const { t } = useTranslation();
    return (
        <Panel size={"small"} className={styles.interaction__panel}>
            <Title
                icon={mapIcons[article.type]}
                className={styles.interaction__title}
                classNameText={styles.interaction__titleText}
            >
                <span className={styles.interaction__provider}>
                    {t(`wallet.interaction.${article.type}`)}
                </span>
                {t("common.at")}{" "}
                {new Date(article.timestamp * 1000).toLocaleString()}
            </Title>
        </Panel>
    );
}
