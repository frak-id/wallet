import type { ReactNode } from "react";
import * as styles from "./PageHeading.css";

export function PageHeading({ children }: { children: ReactNode }) {
    return <h1 className={styles.heading}>{children}</h1>;
}
