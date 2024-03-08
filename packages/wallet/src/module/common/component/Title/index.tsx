import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

export function Title({
    icon,
    className = "",
    children,
}: PropsWithChildren<{ icon?: ReactNode; className?: string }>) {
    return (
        <h2 className={`${styles.title} ${className}`}>
            {icon && <span>{icon}</span>}
            <span className={styles.title__text}>{children}</span>
        </h2>
    );
}
