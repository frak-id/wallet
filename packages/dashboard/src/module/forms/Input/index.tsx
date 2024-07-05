import { mergeElement } from "@/module/common/utils/mergeElement";
import { cva, cx } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { forwardRef, isValidElement } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./index.module.css";

export interface InputProps
    extends InputHTMLAttributes<HTMLInputElement>,
        VariantProps<typeof InputVariants> {
    classNameWrapper?: string;
    leftSection?: string | ReactNode;
    rightSection?: string | ReactNode;
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
                {leftSection && isValidElement(leftSection) ? (
                    mergeElement(leftSection, { className: styles.leftSection })
                ) : (
                    <span className={styles.leftSection}>{leftSection}</span>
                )}
                <input
                    type={type}
                    className={cx(
                        styles.input,
                        className,
                        leftSection ? styles.withLeftSection : undefined
                    )}
                    ref={ref}
                    {...props}
                />
                {rightSection && isValidElement(rightSection) ? (
                    mergeElement(rightSection, {
                        className: styles.rightSection,
                    })
                ) : (
                    <span className={styles.rightSection}>{rightSection}</span>
                )}
            </span>
        );
    }
);
Input.displayName = "Input";
