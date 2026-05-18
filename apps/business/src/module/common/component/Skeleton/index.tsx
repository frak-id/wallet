import clsx from "clsx";
import ReactSkeleton, { type SkeletonProps } from "react-loading-skeleton";
import { skeleton } from "./skeleton.css";

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
            containerClassName={clsx(containerClassName, skeleton)}
            className={clsx(skeleton, className)}
            {...props}
        />
    );
}
