import { useId } from "react";
import styles from "./RangeSlider.module.css";

interface RangeSliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
    output?: boolean;
    helpText?: string;
}

export function RangeSlider({
    label,
    value,
    min,
    max,
    step,
    onChange,
    output,
    helpText,
}: RangeSliderProps) {
    const inputId = useId();

    return (
        <div className={styles.rangeSlider}>
            <label htmlFor={inputId} className={styles.label}>
                {label}
            </label>
            <div className={styles.control}>
                <input
                    id={inputId}
                    className={styles.input}
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                />
                {output && <span className={styles.output}>{value}</span>}
            </div>
            {helpText && <p className={styles.helpText}>{helpText}</p>}
        </div>
    );
}
