import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useChartStable } from "./chart-context";

export interface NumericYAxisProps {
    /** Explicit tick values. Falls back to the scale's own ticks. */
    ticks?: number[];
    /** Formats each tick value into its label. */
    formatter?: (value: number) => string;
    /** Which side of the plot to render labels on. Default: "right" */
    side?: "left" | "right";
}

/**
 * Numeric value ticks for the linear y-scale, rendered as an HTML overlay in
 * the chart margin (portaled into the container) so it escapes the area
 * chart's left-to-right reveal clip. bklit ships only categorical axes; this
 * restores the numeric ticks the dashboard design calls for.
 */
export function NumericYAxis({
    ticks,
    formatter = (v) => `${v}`,
    side = "right",
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
            className="pointer-events-none absolute"
            style={{
                top: 0,
                bottom: 0,
                [side]: 0,
                width: side === "right" ? margin.right : margin.left,
            }}
        >
            {tickValues.map((value) => (
                <span
                    className="absolute text-chart-label text-xs"
                    key={value}
                    style={{
                        top: margin.top + yScale(value),
                        transform: "translateY(-50%)",
                        [side]: 4,
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
