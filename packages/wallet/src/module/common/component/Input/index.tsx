import { useDebounce } from "@/module/common/hook/useDebounce";
import {
    type InputHTMLAttributes,
    forwardRef,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
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
            (debouncedValue: string) => {
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
            callback.current?.(debounceValueCompare(debouncedValue));
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
