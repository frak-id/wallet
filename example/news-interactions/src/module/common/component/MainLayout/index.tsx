import type { ReactNode } from "react";
import styles from "./index.module.css";

export function MainLayout({ children }: { children: ReactNode }) {
    return (
        <div className={"desktop scrollbars"}>
            <main className={styles.main}>
                <div className={styles.inner}>{children}</div>
            </main>
        </div>
    );
}
