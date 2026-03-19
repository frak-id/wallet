import { createFileRoute } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";
import { RewardHistoryList } from "@/module/history/component/RewardHistory";
import * as styles from "@/module/history/page/historyPage.css";

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
        <div>
            <Panel variant={"invisible"} className={styles.historyPanel}>
                <nav className={styles.historyNav}>
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
        </div>
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
    const classActive = currentType === activeType ? styles.historyActive : "";

    return (
        <button
            type="button"
            className={`${styles.historyButton} ${classActive}`}
            onClick={() => onTypeChange(currentType)}
        >
            {children}
        </button>
    );
}
