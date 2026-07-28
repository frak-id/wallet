import type React from "react";
import * as styles from "./SkeletonBodyText.css";
import * as skeletonStyles from "./skeleton.css";

const widths = ["100%", "90%", "95%", "85%", "70%"];

export function SkeletonBodyText({
    lines = 3,
}: {
    lines?: number;
}): React.ReactElement {
    return (
        <div className={styles.bodyText}>
            {Array.from({ length: lines }).map((_, index) => {
                const lineId = `line-${lines}-${index}`;
                return (
                    <div
                        key={lineId}
                        className={`${skeletonStyles.pulse} ${styles.line}`}
                        style={{ width: widths[index % widths.length] }}
                    />
                );
            })}
        </div>
    );
}
