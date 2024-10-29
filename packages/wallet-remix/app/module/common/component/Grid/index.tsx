import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

export function Grid({
    children,
    footer,
    className = "",
}: PropsWithChildren<{ footer?: ReactNode; className?: string }>) {
    return (
        <div className={`${styles.grid} ${className}`}>
            <div>{children}</div>
            {footer && <div>{footer}</div>}
        </div>
    );
}
