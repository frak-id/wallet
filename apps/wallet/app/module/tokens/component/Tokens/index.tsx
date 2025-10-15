import { HandCoins, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Panel } from "@/module/common/component/Panel";
import { Balance } from "@/module/tokens/component/Balance";
import styles from "./index.module.css";

export function Tokens() {
    const { t } = useTranslation();
    return (
        <Panel size={"small"}>
            <Balance />
            <div className={styles.tokens__buttons}>
                <Link
                    to={"/tokens/receive"}
                    className={`${styles.tokens__button}`}
                    viewTransition
                >
                    <HandCoins size={56} absoluteStrokeWidth={true} />
                    {t("common.receive")}
                </Link>
                <Link
                    to={"/tokens/send"}
                    className={`${styles.tokens__button}`}
                    viewTransition
                >
                    <Send size={56} absoluteStrokeWidth={true} />
                    {t("common.send")}
                </Link>
            </div>
        </Panel>
    );
}
