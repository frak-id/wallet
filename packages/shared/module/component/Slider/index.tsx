import { Range, Root, Thumb, Track } from "@radix-ui/react-slider";
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
        <Root
            className={styles.slider__root}
            defaultValue={defaultValue}
            value={value}
            min={min}
            max={max}
            step={step}
            onValueChange={onValueChange}
            onValueCommit={onValueCommit}
        >
            <Track className={styles.slider__track}>
                <Range className={styles.slider__range} />
            </Track>
            <Thumb className={styles.slider__thumb} aria-label={label} />
        </Root>
    );
}
