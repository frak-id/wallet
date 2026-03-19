import { Box } from "@frak-labs/design-system/components/Box";
import { Skeleton as DesignSkeleton } from "@frak-labs/design-system/components/Skeleton";
import * as styles from "./index.css";

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
    const itemCount = count ?? 1;

    return (
        <Box className={`${styles.skeletonContainer} ${containerClassName}`}>
            {Array.from({ length: itemCount }).map((_, index) => (
                <DesignSkeleton
                    key={index}
                    variant="rect"
                    width={width}
                    height={height}
                    className={`${styles.skeleton} ${className}`}
                />
            ))}
        </Box>
    );
}
