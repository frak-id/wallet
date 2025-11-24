import type { ReactNode } from "react";
import styles from "./index.module.css";

export function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div>
            <div className={styles["ellipse-blue-corner"]} />
            <div className={styles["ellipse-blue-top"]} />
            <div className={styles["ellipse-white-1"]} />
            <div className={styles["ellipse-red-1"]} />
            <main className={styles.main}>{children}</main>
        </div>
    );
}
