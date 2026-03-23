import type { RecipeVariants } from "@vanilla-extract/recipes";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Box } from "../Box";
import { button } from "./button.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
    RecipeVariants<typeof button> & {
        children: ReactNode;
        icon?: ReactNode;
    };

export function Button({
    variant,
    size,
    children,
    icon,
    className,
    color: _color,
    ...rest
}: ButtonProps) {
    return (
        <Box
            as="button"
            type="button"
            className={`${button({ variant, size })}${className ? ` ${className}` : ""}`}
            {...rest}
        >
            {icon}
            {children}
        </Box>
    );
}
