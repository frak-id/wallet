import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function Title({ children }: PropsWithChildren) {
    return <h2 className={styles.title}>{children}</h2>;
}
