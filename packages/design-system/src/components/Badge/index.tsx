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
            className={
                [badgeVariants[variant], className].filter(Boolean).join(" ") ||
                undefined
            }
        >
            {children}
        </Box>
    );
}
