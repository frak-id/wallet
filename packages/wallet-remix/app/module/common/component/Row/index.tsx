import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function Row({
    withIcon,
    className = "",
    children,
}: PropsWithChildren<{ withIcon?: boolean; className?: string }>) {
    return (
        <p
            className={`${styles.row} ${
                withIcon ? styles.row__withIcon : ""
            } ${className}`}
        >
            {children}
        </p>
    );
}
