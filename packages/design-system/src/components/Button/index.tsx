import type { RecipeVariants } from "@vanilla-extract/recipes";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Box } from "../Box";
import { Spinner } from "../Spinner";
import { button } from "./button.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
    RecipeVariants<typeof button> & {
        children: ReactNode;
        icon?: ReactNode;
        /** Show a spinner and disable the button */
        loading?: boolean;
    };

export function Button({
    variant,
    size,
    fontSize,
    width,
    children,
    icon,
    loading,
    disabled,
    className,
    color: _color,
    ...rest
}: ButtonProps) {
    return (
        <Box
            as="button"
            type="button"
            className={`${button({ variant, size, width, fontSize })}${className ? ` ${className}` : ""}`}
            disabled={disabled || loading}
            {...rest}
        >
            {loading ? <Spinner size="s" /> : icon}
            {children}
        </Box>
    );
}
