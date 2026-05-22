import type { RecipeVariants } from "@vanilla-extract/recipes";
import type { HTMLAttributes, ReactNode } from "react";
import { Box } from "../Box";
import { Text } from "../Text";
import { card, cardHeader } from "./card.css";

type CardProps = HTMLAttributes<HTMLDivElement> &
    RecipeVariants<typeof card> & {
        children?: ReactNode;
    };

export function Card({
    padding,
    variant,
    children,
    className,
    color: _color,
    ...rest
}: CardProps) {
    return (
        <Box
            className={`${card({ variant, padding })}${className ? ` ${className}` : ""}`}
            {...rest}
        >
            {children}
        </Box>
    );
}

type CardHeaderProps = HTMLAttributes<HTMLDivElement> & {
    children?: ReactNode;
};

/**
 * Header slot for a Card. Pairs `CardTitle` (and optionally
 * `CardDescription`) and adds bottom spacing before the body.
 */
export function CardHeader({
    children,
    className,
    ...rest
}: CardHeaderProps) {
    return (
        <div
            className={`${cardHeader}${className ? ` ${className}` : ""}`}
            {...rest}
        >
            {children}
        </div>
    );
}

type CardTitleProps = {
    children?: ReactNode;
    className?: string;
};

/**
 * Heading inside `CardHeader`. Renders an `<h3>` with the design-system
 * `heading4` Text variant (16px, semiBold, text.primary).
 */
export function CardTitle({ children, className }: CardTitleProps) {
    return (
        <Text as="h3" variant="heading4" weight="semiBold" className={className}>
            {children}
        </Text>
    );
}

type CardDescriptionProps = {
    children?: ReactNode;
    className?: string;
};

/**
 * Optional secondary line under `CardTitle`. Uses `bodySmall` + secondary
 * text color.
 */
export function CardDescription({ children, className }: CardDescriptionProps) {
    return (
        <Text variant="bodySmall" color="secondary" className={className}>
            {children}
        </Text>
    );
}
