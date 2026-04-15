import clsx from "clsx";
import type { ReactNode } from "react";
import { Box } from "../Box";
import { iconCircleSizes } from "./iconCircle.css";

type IconCircleSize = "sm" | "md" | "lg";

type IconCircleProps = {
    size?: IconCircleSize;
    children: ReactNode;
    className?: string;
};

export function IconCircle({
    size = "md",
    children,
    className,
}: IconCircleProps) {
    return (
        <Box className={clsx(iconCircleSizes[size], className) || undefined}>
            {children}
        </Box>
    );
}
