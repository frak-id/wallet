import clsx from "clsx";
import { Children, type PointerEvent, type ReactNode } from "react";

import { Box } from "../Box";
import { badgeLabel, badgeVariants } from "./badge.css";

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
    const parts = Children.toArray(children);
    const text = parts.every(
        (part) => typeof part === "string" || typeof part === "number"
    )
        ? parts.join("")
        : undefined;

    // Only a truncated label gets a title: any title shadows an ancestor's (e.g. a titled link)
    const titleIfTruncated = (event: PointerEvent<HTMLElement>) => {
        const badge = event.currentTarget;
        const label = badge.firstElementChild;
        if (text && label && label.scrollWidth > label.clientWidth) {
            badge.title = text;
        } else {
            badge.removeAttribute("title");
        }
    };

    return (
        <Box
            as="span"
            onPointerEnter={text ? titleIfTruncated : undefined}
            className={
                clsx(badgeVariants({ variant, size }), className) || undefined
            }
        >
            <span className={badgeLabel}>{children}</span>
        </Box>
    );
}
