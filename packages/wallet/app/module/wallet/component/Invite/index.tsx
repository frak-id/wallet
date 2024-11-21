import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

export function Invite() {
    const { t } = useTranslation();
    return (
        <Panel isDismissible={true} className={styles.invite}>
            <div>
                <Title size={"big"}>{t("wallet.invite.title")}</Title>
                <p className={styles.invite__text}>{t("wallet.invite.text")}</p>
            </div>
            <div>
                <img src={"/img/invite_logo.png"} alt="invite" />
            </div>
        </Panel>
    );
}
