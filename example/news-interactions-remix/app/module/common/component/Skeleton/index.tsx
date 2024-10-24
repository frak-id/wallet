import { Skeleton as SkeletonShared } from "@module/component/Skeleton";
import styles from "./index.module.css";

export function Skeleton({
    count = 3,
    height = 100,
}: { count: number; height: number }) {
    return (
        <SkeletonShared
            count={count}
            height={height}
            containerClassName={styles.skeleton__containerClassName}
        />
    );
}
