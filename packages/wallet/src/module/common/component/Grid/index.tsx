import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

export function Grid({
    children,
    footer,
}: PropsWithChildren<{ footer?: ReactNode }>) {
    return (
        <div className={styles.grid}>
            <div>{children}</div>
            {footer && <div>{footer}</div>}
        </div>
    );
}
