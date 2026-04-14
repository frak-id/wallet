import type { ReactNode } from "react";
import styles from "./index.module.css";

export function PreviewWrapper({
    label = "Preview",
    children,
}: {
    label?: string;
    children: ReactNode;
}) {
    return (
        <div className={styles.previewWrapper}>
            <p className={styles.previewWrapper__label}>{label}</p>
            {children}
        </div>
    );
}
