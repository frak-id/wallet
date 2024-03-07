import ReactSkeleton from "react-loading-skeleton";
import styles from "./index.module.css";

type SkeletonProps = {
    width?: number;
    height?: string | number;
    containerClassName?: string;
    className?: string;
};

export function Skeleton({
    width,
    height = 250,
    containerClassName = "",
    className = "",
}: SkeletonProps) {
    return (
        <ReactSkeleton
            width={width}
            height={height}
            containerClassName={`${containerClassName} ${styles.skeleton}`}
            className={`${styles.skeleton} ${className}`}
        />
    );
}
