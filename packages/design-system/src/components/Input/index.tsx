import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { Box } from "../Box";
import { inputField, inputSection, inputWrapper } from "./input.css";

type InputProps = Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "width" | "height" | "color"
> & {
    /**
     * - `"default"` — standard bordered field
     * - `"bare"` — borderless 56px flat card (pair with `tone`)
     */
    variant?: "default" | "bare";
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
    ref,
    ...rest
}: InputProps) {
    return (
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
                className={inputField({ variant })}
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
}
