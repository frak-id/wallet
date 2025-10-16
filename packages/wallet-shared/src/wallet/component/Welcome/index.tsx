import { useTranslation } from "react-i18next";
import { Panel } from "@/common/component/Panel";
import { Title } from "@/common/component/Title";
import styles from "./index.module.css";

export function Welcome() {
    const { t } = useTranslation();
    return (
        <Panel isDismissible={true}>
            <Title size={"big"}>{t("wallet.welcome.title")}</Title>
            <p className={styles.text}>{t("wallet.welcome.text")}</p>
        </Panel>
    );
}
