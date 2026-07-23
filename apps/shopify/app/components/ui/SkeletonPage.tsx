import type React from "react";
import * as styles from "./SkeletonPage.css";
import * as skeletonStyles from "./skeleton.css";

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
