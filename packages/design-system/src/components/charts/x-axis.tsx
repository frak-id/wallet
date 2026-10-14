import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useChart, useChartStable } from "./chart-context";
import { getShortDateFmt } from "./chart-formatters";

const TICKER_HALF_WIDTH = 50;

interface XAxisLabelProps {
    label: string;
    x: number;
    crosshairX: number | null;
    isHovering: boolean;
}

function XAxisLabel({ label, x, crosshairX, isHovering }: XAxisLabelProps) {
    const fadeBuffer = 20;
    const fadeRadius = TICKER_HALF_WIDTH + fadeBuffer;

    let opacity = 1;
    if (isHovering && crosshairX !== null) {
        const distance = Math.abs(x - crosshairX);
        if (distance < TICKER_HALF_WIDTH) {
            opacity = 0;
        } else if (distance < fadeRadius) {
            opacity = (distance - TICKER_HALF_WIDTH) / fadeBuffer;
        }
    }

    return (
        <div
            className="absolute"
            style={{
                left: x,
                bottom: 12,
                width: 0,
                display: "flex",
                justifyContent: "center",
            }}
        >
            <span
                className="whitespace-nowrap text-chart-label text-xs"
                style={{
                    opacity,
                    transition: "opacity 0.4s ease-in-out",
                }}
            >
                {label}
            </span>
        </div>
    );
}

/** One label per data row at its x value. */
export function XAxis() {
    const { containerRef } = useChartStable();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const container = containerRef.current;
    if (!(mounted && container)) {
        return null;
    }

    return <XAxisInner container={container} />;
}

const XAxisInner = memo(function XAxisInner({
    container,
}: {
    container: HTMLDivElement;
}) {
    const { xScale, margin, tooltipData, data, xAccessor, dateLabels, locale } =
        useChart();
    const shortDateFmt = getShortDateFmt(locale);

    const labelsToShow = useMemo(
        () =>
            data.map((d, i) => ({
                date: xAccessor(d),
                x: (xScale(xAccessor(d)) ?? 0) + margin.left,
                label: dateLabels[i] ?? shortDateFmt.format(xAccessor(d)),
            })),
        [data, xAccessor, xScale, margin.left, dateLabels, shortDateFmt]
    );

    const isHovering = tooltipData !== null;
    const crosshairX = tooltipData ? tooltipData.x + margin.left : null;

    return createPortal(
        <div className="pointer-events-none absolute inset-0">
            {labelsToShow.map((item) => (
                <XAxisLabel
                    crosshairX={crosshairX}
                    isHovering={isHovering}
                    key={`${item.date.getTime()}-${item.x}`}
                    label={item.label}
                    x={item.x}
                />
            ))}
        </div>,
        container
    );
});

XAxis.displayName = "XAxis";
