import { Input } from "@/module/common/component/Input";
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
    variant?: "transparent";
}

export const InputRounded = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            type,
            className = "",
            classNameWrapper = "",
            leftSection,
            variant,
            ...props
        },
        ref
    ) => {
        const variantClass = variant ? styles[variant] : "";
        const variantClassInput = variant ? styles[`input--${variant}`] : "";
        return (
            <Input
                ref={ref}
                {...props}
                classNameWrapper={`${styles.inputRoundedWrapper} ${variantClass}`}
                className={`${styles.inputRounded} ${variantClassInput}`}
            />
        );
    }
);
InputRounded.displayName = "InputRounded";
