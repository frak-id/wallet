import type { ReactNode } from "react";
import styles from "./index.module.css";

export function FormLayout({ children }: { children: ReactNode }) {
    return <div className={styles.formLayout}>{children}</div>;
}
