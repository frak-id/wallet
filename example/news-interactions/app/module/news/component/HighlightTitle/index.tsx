import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function HighlightTitle({ children }: PropsWithChildren) {
    return (
        <h2 className={styles.highlightTitle}>
            <span className={styles.highlightTitle__inner}>{children}</span>
        </h2>
    );
}
