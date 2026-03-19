import type { InputHTMLAttributes, ReactNode } from "react";
import { Box } from "../Box";
import { inputStyles, lengthVariants } from "./input.css";

type InputLength = "small" | "medium" | "big";

type InputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "width" | "height" | "color"
> & {
    length?: InputLength;
    leftSection?: ReactNode;
    rightSection?: ReactNode;
    error?: boolean;
    className?: string;
};

export function Input({
    length,
    leftSection,
    rightSection,
    error,
    disabled,
    className,
    ...rest
}: InputProps) {
    const wrapperClassName = [
        inputStyles.wrapper,
        length ? lengthVariants[length] : undefined,
        error ? inputStyles.wrapperError : undefined,
        disabled ? inputStyles.wrapperDisabled : undefined,
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <Box as="span" className={wrapperClassName}>
            {leftSection ? (
                <Box as="span" className={inputStyles.leftSection}>
                    {leftSection}
                </Box>
            ) : null}
            <Box
                as="input"
                className={inputStyles.field}
                disabled={disabled}
                {...rest}
            />
            {rightSection ? (
                <Box as="span" className={inputStyles.rightSection}>
                    {rightSection}
                </Box>
            ) : null}
        </Box>
    );
}
