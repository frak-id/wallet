import { Input as DSInput } from "@frak-labs/design-system/components/Input";
import type { ComponentPropsWithRef, ReactNode } from "react";

export type InputProps = ComponentPropsWithRef<"input"> & {
    length?: "small" | "medium" | "big";
    classNameWrapper?: string;
    leftSection?: ReactNode;
    rightSection?: ReactNode;
};

export const Input = ({
    ref,
    type,
    length,
    className,
    classNameWrapper,
    leftSection,
    rightSection,
    ...rest
}: InputProps) => (
    <DSInput
        ref={ref}
        type={type}
        length={length}
        leftSection={leftSection}
        rightSection={rightSection}
        className={classNameWrapper ?? className}
        {...rest}
    />
);

Input.displayName = "Input";
