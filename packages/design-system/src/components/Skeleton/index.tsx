import type { CSSProperties } from "react";

import { Box } from "../Box";
import { skeletonVariants } from "./skeleton.css";

type SkeletonVariant = "text" | "circle" | "rect";

type SkeletonProps = {
    variant?: SkeletonVariant;
    width?: string | number;
    height?: string | number;
    className?: string;
};

export function Skeleton({
    variant = "text",
    width,
    height,
    className,
}: SkeletonProps) {
    const inlineStyle: CSSProperties = {};
    if (width !== undefined)
        inlineStyle.width = typeof width === "number" ? `${width}px` : width;
    if (height !== undefined)
        inlineStyle.height =
            typeof height === "number" ? `${height}px` : height;

    return (
        <Box
            as="span"
            className={
                [skeletonVariants[variant], className]
                    .filter(Boolean)
                    .join(" ") || undefined
            }
            style={inlineStyle}
        />
    );
}
