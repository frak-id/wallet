import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import { Grid } from "@/module/common/component/Grid";
import { Panel } from "@/module/common/component/Panel";
import { InteractionHistoryList } from "@/module/history/component/InteractionHistory";
import { RewardHistoryList } from "@/module/history/component/RewardHistory";
import styles from "./history.module.css";

type HistoryType = "rewards" | "interaction" | "notifications";

const useHistoryTypeStore = create<{
    type: HistoryType;
    setType: (type: HistoryType) => void;
}>()((set) => ({
    type: "interaction",
    setType: (type) => set({ type }),
}));

export default function History() {
    const { t } = useTranslation();
    const type = useHistoryTypeStore((state) => state.type);
    return (
        <Grid>
            <Panel variant={"invisible"} className={styles.history__panel}>
                <nav className={styles.history__nav}>
                    <ButtonType currentType={"rewards"}>
                        {t("common.rewards")}
                    </ButtonType>{" "}
                    |{" "}
                    <ButtonType currentType={"interaction"}>
                        {t("common.interactions")}
                    </ButtonType>
                </nav>
            </Panel>
            {type === "rewards" && <RewardHistoryList />}
            {type === "interaction" && <InteractionHistoryList />}
        </Grid>
    );
}

function ButtonType({
    currentType,
    children,
}: PropsWithChildren<{ currentType: HistoryType }>) {
    const type = useHistoryTypeStore((state) => state.type);
    const setType = useHistoryTypeStore((state) => state.setType);
    const classActive = currentType === type ? styles.history__active : "";

    return (
        <button
            type="button"
            className={`${styles.history__button} ${classActive}`}
            onClick={() => setType(currentType)}
        >
            {children}
        </button>
    );
}
