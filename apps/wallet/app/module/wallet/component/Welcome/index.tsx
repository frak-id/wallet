import { useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import * as styles from "./index.css";

export function Welcome() {
    const { t } = useTranslation();
    return (
        <Panel isDismissible={true} dismissKey={"welcome"}>
            <Title size={"big"}>{t("wallet.welcome.title")}</Title>
            <p className={styles.text}>{t("wallet.welcome.text")}</p>
        </Panel>
    );
}
