import type { ReactNode } from "react";
import styles from "./index.module.css";

export function MainLayout({ children }: { children: ReactNode }) {
    return <main className={styles.main}>{children}</main>;
}
