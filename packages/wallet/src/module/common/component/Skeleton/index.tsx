import ReactSkeleton from "react-loading-skeleton";
import styles from "./index.module.css";

type SkeletonProps = {
    width?: number;
    height?: string | number;
    containerClassName?: string;
    className?: string;
    count?: number;
};

export function Skeleton({
    width,
    height = 250,
    containerClassName = "",
    className = "",
    count,
}: SkeletonProps) {
    return (
        <ReactSkeleton
            width={width}
            height={height}
            containerClassName={`${styles.skeletonContainer} ${containerClassName}`}
            className={`${styles.skeleton} ${className}`}
            count={count}
        />
    );
}
