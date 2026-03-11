import { ButtonRefresh } from "@frak-labs/ui/component/ButtonRefresh";
import { Link } from "@tanstack/react-router";
import { HandCoins, RefreshCcw, Send } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { isCryptoMode } from "@/module/common/utils/walletMode";
import styles from "./index.module.css";

export function HomeNavigation() {
    const { t } = useTranslation();

    if (!isCryptoMode) return null;

    return (
        <div className={styles.homeNavigation}>
            <Link
                to={"/tokens/receive"}
                className={styles.button}
                viewTransition
            >
                <Button
                    icon={<HandCoins size={36} absoluteStrokeWidth={true} />}
                >
                    {t("common.receive")}
                </Button>
            </Link>
            <Link to={"/tokens/send"} className={styles.button} viewTransition>
                <Button icon={<Send size={26} absoluteStrokeWidth={true} />}>
                    {t("common.send")}
                </Button>
            </Link>
            <ButtonRefresh className={styles.button}>
                <Button icon={<RefreshCcw size={24} />}>
                    {t("common.refresh")}
                </Button>
            </ButtonRefresh>
        </div>
    );
}

function Button({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <>
            <span className={styles.button__icon}>{icon}</span>
            {children}
        </>
    );
}
