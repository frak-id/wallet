import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

export function Title({
    icon,
    children,
}: PropsWithChildren<{ icon?: ReactNode }>) {
    return (
        <h2 className={styles.title}>
            {icon && <span>{icon}</span>}
            <span className={styles.title__text}>{children}</span>
        </h2>
    );
}
