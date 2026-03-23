import type { InputHTMLAttributes, ReactNode } from "react";
import { Box } from "../Box";
import {
    inputField,
    inputWrapper,
    leftSection,
    rightSection,
} from "./input.css";

type InputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "width" | "height" | "color"
> & {
    length?: "small" | "medium" | "big";
    leftSection?: ReactNode;
    rightSection?: ReactNode;
    error?: boolean;
    className?: string;
};

export function Input({
    length,
    leftSection: leftSlot,
    rightSection: rightSlot,
    error,
    disabled,
    className,
    ...rest
}: InputProps) {
    return (
        <Box
            as="span"
            className={`${inputWrapper({ length, error, disabled })}${className ? ` ${className}` : ""}`}
        >
            {leftSlot ? (
                <Box as="span" className={leftSection}>
                    {leftSlot}
                </Box>
            ) : null}
            <Box
                as="input"
                className={inputField}
                disabled={disabled}
                {...rest}
            />
            {rightSlot ? (
                <Box as="span" className={rightSection}>
                    {rightSlot}
                </Box>
            ) : null}
        </Box>
    );
}
