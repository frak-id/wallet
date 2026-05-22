import clsx from "clsx";
import type { ReactNode } from "react";

import { Box } from "../Box";
import { badgeVariants } from "./badge.css";

type BadgeVariant =
    | "success"
    | "warning"
    | "error"
    | "info"
    | "neutral"
    | "disabled";
type BadgeSize = "small" | "medium";

type BadgeProps = {
    variant?: BadgeVariant;
    size?: BadgeSize;
    children: ReactNode;
    className?: string;
};

export function Badge({
    variant = "neutral",
    size = "medium",
    children,
    className,
}: BadgeProps) {
    return (
        <Box
            as="span"
            className={
                clsx(badgeVariants({ variant, size }), className) || undefined
            }
        >
            {children}
        </Box>
    );
}
