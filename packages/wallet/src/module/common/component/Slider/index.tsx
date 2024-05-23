import * as SliderPrimitive from "@radix-ui/react-slider";
import styles from "./index.module.css";

export function Slider({
    label,
    defaultValue,
    value,
    min,
    max,
    step,
    onValueChange,
    onValueCommit,
}: {
    label: string;
    defaultValue?: number[];
    value?: number[];
    min: number;
    max: number;
    step: number;
    onValueChange?: (value: number[]) => void;
    onValueCommit?: (value: number[]) => void;
}) {
    return (
        <SliderPrimitive.Root
            className={styles.slider__root}
            defaultValue={defaultValue}
            value={value}
            min={min}
            max={max}
            step={step}
            onValueChange={onValueChange}
            onValueCommit={onValueCommit}
        >
            <SliderPrimitive.Track className={styles.slider__track}>
                <SliderPrimitive.Range className={styles.slider__range} />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
                className={styles.slider__thumb}
                aria-label={label}
            />
        </SliderPrimitive.Root>
    );
}
