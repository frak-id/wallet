import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function TextData({ children }: PropsWithChildren) {
    return <div className={styles.textData}>{children}</div>;
}
