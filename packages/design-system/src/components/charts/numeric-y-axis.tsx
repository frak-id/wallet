import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useChartStable } from "./chart-context";
import * as styles from "./charts.css";

export interface NumericYAxisProps {
    /** Explicit tick values. Falls back to the scale's own ticks. */
    ticks?: number[];
    /** Formats each tick value into its label. */
    formatter?: (value: number) => string;
}

/**
 * Numeric value ticks for the linear y-scale, rendered as an HTML overlay in
 * the right chart margin (portaled into the container) so it escapes the area
 * chart's left-to-right reveal clip.
 */
export function NumericYAxis({
    ticks,
    formatter = (v) => `${v}`,
}: NumericYAxisProps) {
    const { containerRef, yScale, margin } = useChartStable();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const container = containerRef.current;
    if (!(mounted && container)) {
        return null;
    }

    const tickValues = ticks ?? (yScale.ticks(4) as number[]);

    return createPortal(
        <div
            className={styles.yAxis}
            style={{
                top: 0,
                bottom: 0,
                right: 0,
                width: margin.right,
            }}
        >
            {tickValues.map((value) => (
                <span
                    className={styles.yTickLabel}
                    key={value}
                    style={{
                        top: margin.top + yScale(value),
                        transform: "translateY(-50%)",
                        right: 4,
                    }}
                >
                    {formatter(value)}
                </span>
            ))}
        </div>,
        container
    );
}

NumericYAxis.displayName = "NumericYAxis";
