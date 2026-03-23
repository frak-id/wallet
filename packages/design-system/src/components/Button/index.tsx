import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Box } from "../Box";
import { buttonStyles } from "./button.css";

type ButtonVariant = "primary" | "outlined";
type ButtonSize = "small" | "large";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    children: ReactNode;
    icon?: ReactNode;
};

export function Button({
    variant = "primary",
    size = "large",
    children,
    icon,
    className,
    color: _color,
    ...rest
}: ButtonProps) {
    const variantClass = buttonStyles[variant];
    const sizeClass = buttonStyles.size[size];
    const combinedClassName = [variantClass, sizeClass, className]
        .filter(Boolean)
        .join(" ");

    return (
        <Box as="button" type="button" className={combinedClassName} {...rest}>
            {icon}
            {children}
        </Box>
    );
}
