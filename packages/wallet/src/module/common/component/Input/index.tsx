import { forwardRef } from "react";
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";
import styles from "./index.module.css";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    classNameWrapper?: string;
    defaultValue?: string;
    value?: string;
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
    onChangeValue?: (value: string | undefined) => void;
    leftSection?: string | ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        { type, className = "", classNameWrapper = "", leftSection, ...props },
        ref
    ) => {
        return (
            <span className={`${styles.inputWrapper} ${classNameWrapper}`}>
                {leftSection}
                <input
                    type={type}
                    className={`${className} ${styles.input}`}
                    ref={ref}
                    {...props}
                />
            </span>
        );
    }
);
Input.displayName = "Input";
