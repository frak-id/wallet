import ReactSkeleton, { SkeletonTheme } from "react-loading-skeleton";
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
        <SkeletonTheme
            baseColor="#12244b"
            highlightColor="#001432"
            borderRadius={0}
        >
            <ReactSkeleton
                width={width}
                height={height}
                containerClassName={`${containerClassName} ${styles.skeleton}`}
                className={`${styles.skeleton} ${className}`}
            />
        </SkeletonTheme>
    );
}
