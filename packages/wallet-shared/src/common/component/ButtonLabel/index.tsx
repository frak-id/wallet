import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function ButtonLabel({ children }: PropsWithChildren) {
    return <span className={styles.buttonLabel}>{children}</span>;
}
