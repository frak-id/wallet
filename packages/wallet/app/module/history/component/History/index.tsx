import { Panel } from "@/module/common/component/Panel";
import { InteractionHistory } from "@/module/history/component/InteractionHistory";
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
                </nav>
            </Panel>
            {type === "rewards" && <RewardHistory />}
            {type === "interaction" && <InteractionHistory />}
        </>
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
