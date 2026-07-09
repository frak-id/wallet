import clsx from "clsx";
import type { ReactNode } from "react";
import { Box } from "../Box";
import { iconCircle } from "./iconCircle.css";

type IconCircleSize = "sm" | "md" | "lg";
type IconCircleTone = "neutral" | "action";

type IconCircleProps = {
    size?: IconCircleSize;
    /** Color treatment of the disc. `action` tints the icon brand-blue for hero / emphasis states. */
    tone?: IconCircleTone;
    children: ReactNode;
    className?: string;
};

export function IconCircle({
    size = "md",
    tone = "neutral",
    children,
    className,
}: IconCircleProps) {
    return (
        <Box className={clsx(iconCircle({ size, tone }), className)}>
            {children}
        </Box>
    );
}
