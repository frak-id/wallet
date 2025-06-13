import ReactSkeleton, { type SkeletonProps } from "react-loading-skeleton";
import styles from "./index.module.css";

export function Skeleton({
    width,
    height = 250,
    containerClassName = "",
    className = "",
    ...props
}: SkeletonProps) {
    return (
        <ReactSkeleton
            width={width}
            height={height}
            borderRadius={8}
            containerClassName={`${containerClassName} ${styles.skeleton}`}
            className={`${styles.skeleton} ${className}`}
            {...props}
        />
    );
}
