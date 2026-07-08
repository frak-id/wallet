import clsx from "clsx";
import type { ReactNode, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { Box } from "../Box";
import { Stack } from "../Stack";
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
    /**
     * Composed field label rendered above the control, with `htmlFor`
     * internally wired to the control's `id` (generated via `useId()` when
     * no `id` prop is passed). Omit both `label` and `hint` for the
     * bare-control render.
     */
    label?: ReactNode;
    /** Hint rendered below the control, linked via `aria-describedby`. */
    hint?: ReactNode;
};

export function TextArea({
    length,
    error,
    disabled,
    resize = "vertical",
    className,
    label,
    hint,
    id,
    "aria-describedby": ariaDescribedBy,
    ...rest
}: TextAreaProps) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const hintId = hint ? `${fieldId}-hint` : undefined;
    const describedBy =
        [ariaDescribedBy, hintId].filter(Boolean).join(" ") || undefined;

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

    const control = (
        <Box as="span" className={wrapperClassName}>
            <Box
                as="textarea"
                id={label ? fieldId : id}
                aria-describedby={describedBy}
                className={fieldClassName}
                disabled={disabled}
                {...rest}
            />
        </Box>
    );

    if (!label && !hint) {
        return control;
    }

    return (
        // Field spec: 8px (spacing.xs) label→control, 4px (spacing.xxs)
        // control→hint. The hint nests with the control so the label keeps its
        // 8px offset while the hint sits 4px under the field.
        <Stack space="xs">
            {label ? (
                <Box
                    as="label"
                    htmlFor={fieldId}
                    className={textareaStyles.fieldLabel}
                >
                    {label}
                </Box>
            ) : null}
            {hint ? (
                <Stack space="xxs">
                    {control}
                    <Box
                        as="span"
                        id={hintId}
                        className={textareaStyles.fieldHint}
                    >
                        {hint}
                    </Box>
                </Stack>
            ) : (
                control
            )}
        </Stack>
    );
}
