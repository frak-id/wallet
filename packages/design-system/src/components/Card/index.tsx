import type { RecipeVariants } from "@vanilla-extract/recipes";
import type { HTMLAttributes, ReactNode } from "react";
import { Box } from "../Box";
import { card } from "./card.css";

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
