import type { ReactNode } from "react";
import { Panel } from "@/module/common/component/Panel";
import styles from "./index.module.css";

export function ActionsWrapper({
    left,
    right,
}: {
    left?: ReactNode;
    right?: ReactNode;
}) {
    return (
        <Panel variant={"secondary"} className={styles.actions}>
            {left && <div className={styles.action__left}>{left}</div>}
            {right && <div className={styles.action__right}>{right}</div>}
        </Panel>
    );
}
