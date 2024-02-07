import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function Panel({ children }: PropsWithChildren) {
    return <div className={styles.panel}>{children}</div>;
}
