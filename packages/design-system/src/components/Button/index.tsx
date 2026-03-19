import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Box } from "../Box";
import { buttonStyles } from "./button.css";

type ButtonVariant = "primary" | "outlined";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    children: ReactNode;
    icon?: ReactNode;
};

export function Button({
    variant = "primary",
    children,
    icon,
    className,
    color: _color,
    ...rest
}: ButtonProps) {
    const variantClass = buttonStyles[variant];
    const combinedClassName = [variantClass, className]
        .filter(Boolean)
        .join(" ");

    return (
        <Box as="button" type="button" className={combinedClassName} {...rest}>
            {icon}
            {children}
        </Box>
    );
}
