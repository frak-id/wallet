"use client";

import { Panel } from "@/module/common/component/Panel";
import { InteractionHistory } from "@/module/history/component/InteractionHistory";
import { RewardHistory } from "@/module/history/component/RewardHistory";
import { atom, useAtom, useAtomValue } from "jotai";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type HistoryType = "rewards" | "interaction";

const historyTypeAtom = atom<HistoryType>("interaction");

export function History() {
    const type = useAtomValue(historyTypeAtom);
    return (
        <>
            <Panel className={styles.history__panel}>
                <nav className={styles.history__nav}>
                    <ButtonType currentType={"interaction"}>
                        Interaction
                    </ButtonType>{" "}
                    | <ButtonType currentType={"rewards"}>Rewards</ButtonType>
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
    return (
        <button
            type="button"
            className={`${currentType === type ? styles.history__active : ""} button`}
            onClick={() => setType(currentType)}
        >
            {children}
        </button>
    );
}
