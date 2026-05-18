import type { RecipeVariants } from "@vanilla-extract/recipes";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { isValidElement } from "react";
import { hasClassName } from "@/module/common/utils/hasClassName";
import { mergeElement } from "@/module/common/utils/mergeElement";
import { input, inputWrapper, rightSection } from "./input.css";

type InputWrapperVariants = NonNullable<RecipeVariants<typeof inputWrapper>>;

export type InputProps = ComponentPropsWithRef<"input"> &
    InputWrapperVariants & {
        classNameWrapper?: string;
        leftSection?: string | ReactNode;
        rightSection?: string | ReactNode;
    };

export const Input = ({
    ref,
    type,
    length,
    className = "",
    classNameWrapper = "",
    leftSection,
    rightSection: rightSlot,
    ...props
}: InputProps) => {
    return (
        <span
            className={`${inputWrapper({ length })}${
                classNameWrapper ? ` ${classNameWrapper}` : ""
            }`}
        >
            {leftSection}
            <input
                type={type}
                className={`${input}${className ? ` ${className}` : ""}`}
                ref={ref}
                {...props}
            />
            {rightSlot && isValidElement(rightSlot) ? (
                mergeElement(rightSlot, {
                    className: `${rightSection} ${
                        hasClassName(rightSlot)
                            ? rightSlot.props.className
                            : ""
                    }`,
                })
            ) : (
                <span className={rightSection}>{rightSlot}</span>
            )}
        </span>
    );
};
Input.displayName = "Input";
