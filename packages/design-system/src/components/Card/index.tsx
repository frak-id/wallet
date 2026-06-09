import type { RecipeVariants } from "@vanilla-extract/recipes";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { Box } from "../Box";
import { Text } from "../Text";
import { card, cardHeader } from "./card.css";

type TextProps = ComponentProps<typeof Text>;

type CardProps = HTMLAttributes<HTMLDivElement> &
    RecipeVariants<typeof card> & {
        children?: ReactNode;
    };

export function Card({
    padding,
    variant,
    radius,
    children,
    className,
    color: _color,
    ...rest
}: CardProps) {
    return (
        <Box
            className={`${card({ variant, padding, radius })}${className ? ` ${className}` : ""}`}
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
export function CardHeader({ children, className, ...rest }: CardHeaderProps) {
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
    as?: TextProps["as"];
    variant?: TextProps["variant"];
    weight?: TextProps["weight"];
    color?: TextProps["color"];
};

/**
 * Heading inside `CardHeader`. Defaults to an `<h3>` with the design-system
 * `heading4` Text variant (16px, semiBold). Pass `as`/`variant`/`weight`/
 * `color` to render a quieter group label (e.g. settings sections).
 */
export function CardTitle({
    children,
    className,
    as = "h3",
    variant = "heading4",
    weight = "semiBold",
    color,
}: CardTitleProps) {
    return (
        <Text
            as={as}
            variant={variant}
            weight={weight}
            color={color}
            className={className}
        >
            {children}
        </Text>
    );
}

type CardDescriptionProps = {
    children?: ReactNode;
    className?: string;
    variant?: TextProps["variant"];
    color?: TextProps["color"];
};

/**
 * Optional secondary line under `CardTitle`. Defaults to `bodySmall` +
 * secondary; override `variant`/`color` for quieter group descriptions.
 */
export function CardDescription({
    children,
    className,
    variant = "bodySmall",
    color = "secondary",
}: CardDescriptionProps) {
    return (
        <Text variant={variant} color={color} className={className}>
            {children}
        </Text>
    );
}
