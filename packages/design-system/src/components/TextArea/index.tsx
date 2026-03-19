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
    className?: string;
};

export function TextArea({
    length,
    error,
    disabled,
    className,
    ...rest
}: TextAreaProps) {
    const wrapperClassName = [
        textareaStyles.wrapper,
        length ? lengthVariants[length] : undefined,
        error ? textareaStyles.wrapperError : undefined,
        disabled ? textareaStyles.wrapperDisabled : undefined,
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <Box as="span" className={wrapperClassName}>
            <Box
                as="textarea"
                className={textareaStyles.field}
                disabled={disabled}
                {...rest}
            />
        </Box>
    );
}
