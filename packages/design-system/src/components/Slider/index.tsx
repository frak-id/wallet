import * as RadixSlider from "@radix-ui/react-slider";
import type { ComponentPropsWithRef } from "react";
import {
    sliderRange,
    sliderRoot,
    sliderThumb,
    sliderTrack,
} from "./slider.css";

type SliderProps = ComponentPropsWithRef<typeof RadixSlider.Root> & {
    className?: string;
    /** Accessible label for the thumb */
    label?: string;
};

/**
 * Themed slider — wraps Radix Slider with track, range, and thumb.
 */
export function Slider({ className, label, ...props }: SliderProps) {
    const combinedClassName = [sliderRoot, className].filter(Boolean).join(" ");

    return (
        <RadixSlider.Root className={combinedClassName} {...props}>
            <RadixSlider.Track className={sliderTrack}>
                <RadixSlider.Range className={sliderRange} />
            </RadixSlider.Track>
            <RadixSlider.Thumb className={sliderThumb} aria-label={label} />
        </RadixSlider.Root>
    );
}
