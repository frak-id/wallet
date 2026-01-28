import { createFileRoute } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Grid } from "@/module/common/component/Grid";
import { Panel } from "@/module/common/component/Panel";
import { RewardHistoryList } from "@/module/history/component/RewardHistory";
import styles from "@/module/history/page/HistoryPage.module.css";

export const Route = createFileRoute("/_wallet/_protected/history")({
    component: HistoryPage,
});

type HistoryType = "rewards" | "notifications";

/**
 * HistoryPage
 *
 * Page that displays user history with tabs for rewards and interactions
 *
 * @returns {JSX.Element} The rendered history page
 */
function HistoryPage() {
    const { t } = useTranslation();
    const [type, setType] = useState<HistoryType>("rewards");

    return (
        <Grid>
            <Panel variant={"invisible"} className={styles.history__panel}>
                <nav className={styles.history__nav}>
                    <ButtonType
                        currentType={"rewards"}
                        activeType={type}
                        onTypeChange={setType}
                    >
                        {t("common.rewards")}
                    </ButtonType>
                </nav>
            </Panel>
            {type === "rewards" && <RewardHistoryList />}
        </Grid>
    );
}

function ButtonType({
    currentType,
    activeType,
    onTypeChange,
    children,
}: PropsWithChildren<{
    currentType: HistoryType;
    activeType: HistoryType;
    onTypeChange: (type: HistoryType) => void;
}>) {
    const classActive =
        currentType === activeType ? styles.history__active : "";

    return (
        <button
            type="button"
            className={`${styles.history__button} ${classActive}`}
            onClick={() => onTypeChange(currentType)}
        >
            {children}
        </button>
    );
}
