import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HandCoins, RefreshCcw, Send } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isCryptoMode } from "@/module/common/utils/walletMode";
import * as styles from "./index.css";

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
                <NavButton
                    icon={<HandCoins size={36} absoluteStrokeWidth={true} />}
                >
                    {t("common.receive")}
                </NavButton>
            </Link>
            <Link to={"/tokens/send"} className={styles.button} viewTransition>
                <NavButton icon={<Send size={26} absoluteStrokeWidth={true} />}>
                    {t("common.send")}
                </NavButton>
            </Link>
            <RefreshButton className={styles.button}>
                <NavButton icon={<RefreshCcw size={24} />}>
                    {t("common.refresh")}
                </NavButton>
            </RefreshButton>
        </div>
    );
}

function NavButton({
    icon,
    children,
}: {
    icon: ReactNode;
    children: ReactNode;
}) {
    return (
        <>
            <span className={styles.buttonIcon}>{icon}</span>
            {children}
        </>
    );
}

function RefreshButton({
    className = "",
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (!isRefreshing) return;
        const timer = setTimeout(() => setIsRefreshing(false), 2_000);
        return () => clearTimeout(timer);
    }, [isRefreshing]);

    return (
        <button
            type={"button"}
            className={`${styles.buttonRefresh} ${isRefreshing ? styles.buttonRefreshing : ""} ${className}`}
            title={"Force refresh"}
            onClick={() => {
                setIsRefreshing(true);
                queryClient.resetQueries().then(() => setIsRefreshing(false));
            }}
        >
            {children}
        </button>
    );
}
