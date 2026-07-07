import { Input as DSInput } from "@frak-labs/design-system/components/Input";
import type { ComponentPropsWithRef, ReactNode } from "react";

export type InputProps = ComponentPropsWithRef<"input"> & {
    variant?: "default" | "bare" | "soft";
    length?: "small" | "medium" | "big";
    tone?: "elevated" | "muted";
    error?: boolean;
    classNameWrapper?: string;
    leftSection?: ReactNode;
    rightSection?: ReactNode;
    /** Composed field label rendered above the control by the DS `Input`. */
    label?: ReactNode;
    /** Composed field hint rendered below the control by the DS `Input`. */
    hint?: ReactNode;
};

export const Input = ({
    ref,
    type,
    variant,
    length,
    tone,
    error,
    className,
    classNameWrapper,
    leftSection,
    rightSection,
    ...rest
}: InputProps) => (
    <DSInput
        ref={ref}
        type={type}
        variant={variant}
        length={length}
        tone={tone}
        error={error}
        leftSection={leftSection}
        rightSection={rightSection}
        className={classNameWrapper ?? className}
        {...rest}
    />
);

Input.displayName = "Input";
