import type { HTMLAttributes, ReactNode } from "react";
import { Box } from "@/components/Box";
import { cardStyles } from "./card.css";

type CardPadding = "none" | "compact" | "default";
type CardVariant = "elevated" | "muted";

type CardProps = HTMLAttributes<HTMLDivElement> & {
    padding?: CardPadding;
    variant?: CardVariant;
    children?: ReactNode;
};

const paddingMap: Record<CardPadding, string> = {
    none: cardStyles.paddingNone,
    compact: cardStyles.paddingCompact,
    default: cardStyles.paddingDefault,
};

export function Card({
    padding = "default",
    variant = "elevated",
    children,
    className,
    color: _color,
    ...rest
}: CardProps) {
    const variantClass = cardStyles[variant];
    const paddingClass = paddingMap[padding];
    const combinedClassName = [variantClass, paddingClass, className]
        .filter(Boolean)
        .join(" ");

    return (
        <Box className={combinedClassName} {...rest}>
            {children}
        </Box>
    );
}
