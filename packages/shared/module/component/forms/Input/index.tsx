import { mergeElement } from "@module/utils/mergeElement";
import { cva, cx } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { forwardRef, isValidElement } from "react";
import type { InputHTMLAttributes, ReactElement } from "react";
import styles from "./index.module.css";

export interface InputProps
    extends InputHTMLAttributes<HTMLInputElement>,
        VariantProps<typeof InputVariants> {
    classNameWrapper?: string;
    leftSection?: string | ReactElement<{ className?: string }>;
    rightSection?: string | ReactElement<{ className?: string }>;
}

export const InputVariants = cva(styles.inputWrapper, {
    variants: {
        length: {
            small: styles["inputWrapper--small"],
            medium: styles["inputWrapper--medium"],
            big: styles["inputWrapper--big"],
        },
    },
});

export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            type,
            length,
            className = "",
            classNameWrapper = "",
            leftSection,
            rightSection,
            ...props
        },
        ref
    ) => {
        return (
            <span
                className={`${InputVariants({
                    length,
                })} ${classNameWrapper}`}
            >
                {leftSection}
                <input
                    type={type}
                    className={cx(styles.input, className)}
                    ref={ref}
                    {...props}
                />
                {rightSection && isValidElement(rightSection) ? (
                    mergeElement(rightSection, {
                        className: cx(
                            styles.rightSection,
                            rightSection?.props?.className
                        ),
                    })
                ) : (
                    <span className={styles.rightSection}>{rightSection}</span>
                )}
            </span>
        );
    }
);
Input.displayName = "Input";
