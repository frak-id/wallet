import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { useId } from "react";
import { Box } from "../Box";
import { Stack } from "../Stack";
import {
    fieldHint,
    fieldLabel,
    inputField,
    inputSection,
    inputWrapper,
} from "./input.css";

type InputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "width" | "height" | "color"
> & {
    /**
     * - `"default"` — standard bordered field
     * - `"bare"` — borderless 56px flat card (pair with `tone`)
     * - `"soft"` — borderless white search field with compact padding
     */
    variant?: "default" | "bare" | "soft";
    length?: "small" | "medium" | "big";
    /**
     * Surface tone for `variant="bare"`. Use `elevated` (default, white)
     * when the page background is not white; use `muted` (#f7f7f7) when
     * the page itself is white and the input needs contrast.
     */
    tone?: "elevated" | "muted";
    leftSection?: ReactNode;
    rightSection?: ReactNode;
    error?: boolean;
    className?: string;
    /** Class for the inner `<input>` (the wrapper takes `className`). */
    inputClassName?: string;
    /**
     * Composed field label rendered above the control, with `htmlFor`
     * internally wired to the control's `id` (generated via `useId()` when
     * no `id` prop is passed). Omit both `label` and `hint` for the
     * bare-control render.
     */
    label?: ReactNode;
    /** Hint rendered below the control, linked via `aria-describedby`. */
    hint?: ReactNode;
    ref?: Ref<HTMLInputElement>;
};

export function Input({
    variant = "default",
    length,
    tone,
    leftSection: leftSlot,
    rightSection: rightSlot,
    error,
    disabled,
    className,
    inputClassName,
    label,
    hint,
    id,
    "aria-describedby": ariaDescribedBy,
    ref,
    ...rest
}: InputProps) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const hintId = hint ? `${fieldId}-hint` : undefined;
    const describedBy =
        [ariaDescribedBy, hintId].filter(Boolean).join(" ") || undefined;

    const control = (
        <Box
            as="span"
            className={`${inputWrapper({ variant, length, tone, error, disabled })}${className ? ` ${className}` : ""}`}
        >
            {leftSlot ? (
                <Box
                    as="span"
                    className={inputSection({ variant, side: "left" })}
                >
                    {leftSlot}
                </Box>
            ) : null}
            <Box
                as="input"
                ref={ref}
                id={label ? fieldId : id}
                aria-describedby={describedBy}
                className={`${inputField({ variant })}${inputClassName ? ` ${inputClassName}` : ""}`}
                disabled={disabled}
                {...rest}
            />
            {rightSlot ? (
                <Box
                    as="span"
                    className={inputSection({ variant, side: "right" })}
                >
                    {rightSlot}
                </Box>
            ) : null}
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
                <Box as="label" htmlFor={fieldId} className={fieldLabel}>
                    {label}
                </Box>
            ) : null}
            {hint ? (
                <Stack space="xxs">
                    {control}
                    <Box as="span" id={hintId} className={fieldHint}>
                        {hint}
                    </Box>
                </Stack>
            ) : (
                control
            )}
        </Stack>
    );
}
