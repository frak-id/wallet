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
    height = 350,
    containerClassName = "",
    className = "",
}: SkeletonProps) {
    return (
        <SkeletonTheme highlightColor="#dcdcdc" borderRadius={0}>
            <ReactSkeleton
                width={width}
                height={height}
                containerClassName={`${containerClassName} ${styles.skeleton}`}
                className={`${styles.skeleton} ${className}`}
                borderRadius={8}
            />
        </SkeletonTheme>
    );
}
