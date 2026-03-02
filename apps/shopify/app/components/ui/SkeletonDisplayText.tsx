import type React from "react";
import styles from "./SkeletonDisplayText.module.css";
import skeletonStyles from "./skeleton.module.css";

const sizeMap = {
    small: 20,
    medium: 28,
    large: 36,
} as const;

export function SkeletonDisplayText({
    size = "medium",
}: {
    size?: "small" | "medium" | "large";
}): React.ReactElement {
    const height = sizeMap[size];

    return (
        <div
            className={`${skeletonStyles.pulse} ${styles.displayText}`}
            style={{ height: `${height}px` }}
        />
    );
}
