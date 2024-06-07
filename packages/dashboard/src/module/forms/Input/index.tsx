import { mergeElement } from "@/module/common/utils/mergeElement";
import { cx } from "class-variance-authority";
import { forwardRef, isValidElement } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./index.module.css";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    classNameWrapper?: string;
    leftSection?: string | ReactNode;
    rightSection?: string | ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            type,
            className = "",
            classNameWrapper = "",
            leftSection,
            rightSection,
            ...props
        },
        ref
    ) => {
        return (
            <span className={`${styles.inputWrapper} ${classNameWrapper}`}>
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
                        leftSection && styles.withLeftSection
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
