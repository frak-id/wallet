import { useDebounce } from "@uidotdev/usehooks";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import styles from "./index.module.css";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    classNameWrapper?: string;
    defaultValue?: string;
    value?: string;
    onChangeValue?: (value: string | undefined) => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            type,
            className,
            defaultValue = "",
            value = "",
            classNameWrapper = "",
            onChangeValue,
            ...props
        },
        ref
    ) => {
        const [valueLocal, setValueLocal] = useState<string>(defaultValue);
        const debouncedValue = useDebounce(valueLocal, 300);
        const callback = useRef<typeof onChangeValue>();
        callback.current = onChangeValue;

        const debounceValueCompare = useCallback(
            (debouncedValue: string): string | undefined => {
                if (value !== debouncedValue) {
                    return debouncedValue;
                }
            },
            [value]
        );

        useEffect(() => {
            if (!value) return;
            setValueLocal(value);
        }, [value]);

        useEffect(() => {
            const difference = debounceValueCompare(debouncedValue);
            typeof difference === "string" && callback.current?.(difference);
        }, [debouncedValue, debounceValueCompare]);

        return (
            <span className={`${styles.inputWrapper} ${classNameWrapper}`}>
                <input
                    type={type}
                    value={valueLocal}
                    onChange={(event) =>
                        setValueLocal(event.currentTarget.value)
                    }
                    className={`${className} ${styles.input}`}
                    ref={ref}
                    {...props}
                />
            </span>
        );
    }
);
Input.displayName = "Input";
