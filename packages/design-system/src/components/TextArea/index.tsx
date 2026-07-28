import clsx from "clsx";
import type { ReactNode, TextareaHTMLAttributes } from "react";
import { Box } from "../Box";
import { FieldLabel } from "../FieldLabel";
import { useFieldIds } from "../useFieldIds";
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
    const { fieldId, hintId, describedBy } = useFieldIds({
        id,
        hint,
        ariaDescribedBy,
    });

    const wrapperClassName = clsx(
        textareaStyles.wrapper,
        length && lengthVariants({ length }),
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
        <FieldLabel label={label} hint={hint} htmlFor={fieldId} hintId={hintId}>
            {control}
        </FieldLabel>
    );
}
