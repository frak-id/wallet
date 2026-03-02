import type { ReactNode } from "react";
import styles from "./PageHeading.module.css";

export function PageHeading({ children }: { children: ReactNode }) {
    return <h1 className={styles.heading}>{children}</h1>;
}
