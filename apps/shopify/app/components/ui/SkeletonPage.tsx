import type React from "react";
import styles from "./SkeletonPage.module.css";
import skeletonStyles from "./skeleton.module.css";

export function SkeletonPage({
    children,
}: {
    children?: React.ReactNode;
}): React.ReactElement {
    return (
        <div className={styles.page}>
            <div className={`${skeletonStyles.pulse} ${styles.title}`} />
            {children}
        </div>
    );
}
