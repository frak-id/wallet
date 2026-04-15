import clsx from "clsx";
import type { ReactNode } from "react";

import { Box } from "../Box";
import { badgeVariants } from "./badge.css";

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";

type BadgeProps = {
    variant?: BadgeVariant;
    children: ReactNode;
    className?: string;
};

export function Badge({
    variant = "neutral",
    children,
    className,
}: BadgeProps) {
    return (
        <Box
            as="span"
            className={clsx(badgeVariants[variant], className) || undefined}
        >
            {children}
        </Box>
    );
}
