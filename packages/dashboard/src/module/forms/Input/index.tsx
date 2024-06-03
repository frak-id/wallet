import { cloneElement, forwardRef, isValidElement } from "react";
import type {
    ChangeEvent,
    InputHTMLAttributes,
    ReactElement,
    ReactNode,
} from "react";
import styles from "./index.module.css";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    classNameWrapper?: string;
    defaultValue?: string;
    value?: string;
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    onChangeValue?: (value: string | undefined) => void;
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
                    cloneElement(
                        leftSection as ReactElement<{ className?: string }>,
                        { className: styles.leftSection }
                    )
                ) : (
                    <span className={styles.leftSection}>{leftSection}</span>
                )}
                <input
                    type={type}
                    className={`${className} ${styles.input} ${
                        leftSection ? styles.withLeftSection : ""
                    }`}
                    ref={ref}
                    {...props}
                />
                {rightSection && isValidElement(rightSection) ? (
                    cloneElement(
                        rightSection as ReactElement<{ className?: string }>,
                        { className: styles.rightSection }
                    )
                ) : (
                    <span className={styles.rightSection}>{rightSection}</span>
                )}
            </span>
        );
    }
);
Input.displayName = "Input";
