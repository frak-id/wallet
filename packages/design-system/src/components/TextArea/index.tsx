import clsx from "clsx";
import type { TextareaHTMLAttributes } from "react";
import { Box } from "../Box";
import { lengthVariants, textareaStyles } from "./textarea.css";

type TextAreaLength = "small" | "medium" | "big";

type TextAreaProps = Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "width" | "height" | "color"
> & {
    length?: TextAreaLength;
    error?: boolean;
    /** Resize behavior of the inner textarea (defaults to vertical). */
    resize?: "vertical" | "none";
    className?: string;
};

export function TextArea({
    length,
    error,
    disabled,
    resize = "vertical",
    className,
    ...rest
}: TextAreaProps) {
    const wrapperClassName = clsx(
        textareaStyles.wrapper,
        length && lengthVariants[length],
        error && textareaStyles.wrapperError,
        disabled && textareaStyles.wrapperDisabled,
        className
    );

    const fieldClassName = clsx(
        textareaStyles.field,
        resize === "none" && textareaStyles.fieldNoResize
    );

    return (
        <Box as="span" className={wrapperClassName}>
            <Box
                as="textarea"
                className={fieldClassName}
                disabled={disabled}
                {...rest}
            />
        </Box>
    );
}
