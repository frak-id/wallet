"use client";

import { Panel } from "@/module/common/component/Panel";
import { InteractionHistory } from "@/module/history/component/InteractionHistory";
import { NotificationHistory } from "@/module/history/component/NotificationHistory";
import { RewardHistory } from "@/module/history/component/RewardHistory";
import { atom, useAtom, useAtomValue } from "jotai";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

type HistoryType = "rewards" | "interaction" | "notifications";

const historyTypeAtom = atom<HistoryType>("interaction");

export function History() {
    const { t } = useTranslation();
    const type = useAtomValue(historyTypeAtom);
    return (
        <>
            <Panel variant={"invisible"} className={styles.history__panel}>
                <nav className={styles.history__nav}>
                    <ButtonType currentType={"rewards"}>
                        {t("common.rewards")}
                    </ButtonType>{" "}
                    |{" "}
                    <ButtonType currentType={"interaction"}>
                        {t("common.interactions")}
                    </ButtonType>
                    |{" "}
                    <ButtonType currentType={"notifications"}>
                        {t("common.notifications")}
                    </ButtonType>
                </nav>
            </Panel>
            {type === "rewards" && <RewardHistory />}
            {type === "interaction" && <InteractionHistory />}
            {type === "notifications" && <NotificationHistory />}
        </>
    );
}

function ButtonType({
    currentType,
    children,
}: PropsWithChildren<{ currentType: HistoryType }>) {
    const [type, setType] = useAtom(historyTypeAtom);
    return (
        <button
            type="button"
            className={`${currentType === type ? styles.history__active : ""} button ${styles.history__inactive}`}
            onClick={() => setType(currentType)}
        >
            {children}
        </button>
    );
}
