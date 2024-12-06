import { Panel } from "@/module/common/component/Panel";
import styles from "./index.module.css";

export function ActionsWrapper({
    left,
    right,
}: { left?: React.ReactNode; right?: React.ReactNode }) {
    return (
        <Panel variant={"secondary"} className={styles.actions}>
            {left && <div className={styles.action__left}>{left}</div>}
            {right && <div className={styles.action__right}>{right}</div>}
        </Panel>
    );
}
