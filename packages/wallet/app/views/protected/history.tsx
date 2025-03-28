import { Grid } from "@/module/common/component/Grid";
import { Panel } from "@/module/common/component/Panel";
import { InteractionHistoryList } from "@/module/history/component/InteractionHistory";
import { RewardHistoryList } from "@/module/history/component/RewardHistory";
import { atom, useAtom, useAtomValue } from "jotai";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import styles from "./history.module.css";

type HistoryType = "rewards" | "interaction" | "notifications";

const historyTypeAtom = atom<HistoryType>("interaction");

export default function History() {
    const { t } = useTranslation();
    const type = useAtomValue(historyTypeAtom);
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
    const [type, setType] = useAtom(historyTypeAtom);
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
