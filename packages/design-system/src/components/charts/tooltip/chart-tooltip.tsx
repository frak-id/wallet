import { motion, useSpring } from "motion/react";
import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { vars } from "../../../theme.css";
import { useChart, useChartStable } from "../chart-context";
import { getWeekdayDateFmt } from "../chart-formatters";
import * as styles from "../charts.css";
import { DateTicker } from "./date-ticker";
import { TooltipBox } from "./tooltip-box";
import { TooltipContent, type TooltipRow } from "./tooltip-content";

const TOOLTIP_SPRING = { stiffness: 300, damping: 30 };

export interface ChartTooltipProps {
    /** Whether to show the date pill at bottom. Default: true */
    showDatePill?: boolean;
    /** Row renderer - return array of TooltipRow */
    rows: (point: Record<string, unknown>) => TooltipRow[];
}

interface ChartTooltipInnerProps extends ChartTooltipProps {
    container: HTMLElement;
}

const ChartTooltipInner = memo(function ChartTooltipInner({
    showDatePill = true,
    rows: rowsRenderer,
    container,
}: ChartTooltipInnerProps) {
    const {
        tooltipData,
        width,
        innerHeight,
        margin,
        lines,
        xAccessor,
        dateLabels,
        containerRef,
        barXAccessor,
        locale,
    } = useChart();

    const discreteInteraction = dateLabels.length > 60;

    const visible = tooltipData !== null;
    const x = tooltipData?.x ?? 0;
    const xWithMargin = x + margin.left;

    const tooltipRows = useMemo(
        () => (tooltipData ? rowsRenderer(tooltipData.point) : []),
        [tooltipData, rowsRenderer]
    );

    // Title from date or category
    const title = useMemo(() => {
        if (!tooltipData) {
            return undefined;
        }
        // For bar charts, use the category name
        if (barXAccessor) {
            return barXAccessor(tooltipData.point);
        }
        // For area charts, use the date
        return getWeekdayDateFmt(locale).format(xAccessor(tooltipData.point));
    }, [tooltipData, barXAccessor, xAccessor, locale]);

    const tooltipContent = (
        <>
            {/* Crosshair indicator - rendered as SVG overlay */}
            <svg
                aria-hidden="true"
                className={styles.overlay}
                height="100%"
                width="100%"
            >
                <g transform={`translate(${margin.left},${margin.top})`}>
                    <TooltipIndicator
                        animate={!discreteInteraction}
                        height={innerHeight}
                        visible={visible}
                        x={x}
                    />
                </g>
            </svg>

            {/* Dots on bars/lines */}
            {visible && (
                <svg
                    aria-hidden="true"
                    className={styles.overlay}
                    height="100%"
                    width="100%"
                >
                    <g transform={`translate(${margin.left},${margin.top})`}>
                        {lines.map((line, index) => (
                            <TooltipDot
                                color={tooltipRows[index]?.color || line.stroke}
                                key={line.dataKey}
                                x={tooltipData?.xPositions?.[line.dataKey] ?? x}
                                y={tooltipData?.yPositions[line.dataKey] ?? 0}
                            />
                        ))}
                    </g>
                </svg>
            )}

            <TooltipBox
                containerRef={containerRef}
                containerWidth={width}
                top={margin.top}
                visible={visible}
                x={xWithMargin}
            >
                <TooltipContent
                    locale={locale}
                    rows={tooltipRows}
                    title={title}
                />
            </TooltipBox>

            <DatePillTracker
                currentIndex={tooltipData?.index ?? 0}
                discreteInteraction={discreteInteraction}
                enabled={showDatePill}
                labels={dateLabels}
                visible={visible}
                xWithMargin={xWithMargin}
            />
        </>
    );

    return createPortal(tooltipContent, container);
});

export function ChartTooltip(props: ChartTooltipProps) {
    const { containerRef } = useChartStable();
    const [mounted, setMounted] = useState(false);

    // Only render portals on client side after mount
    useEffect(() => {
        setMounted(true);
    }, []);

    const container = containerRef.current;
    if (!(mounted && container)) {
        return null;
    }

    return <ChartTooltipInner {...props} container={container} />;
}

ChartTooltip.displayName = "ChartTooltip";

interface TooltipIndicatorProps {
    x: number;
    height: number;
    visible: boolean;
    animate: boolean;
}

// Inner-only-on-visible so `useSpring` initializes at the real cursor x
// instead of 0 on first hover.
function TooltipIndicator(props: TooltipIndicatorProps) {
    if (!props.visible) {
        return null;
    }
    return <TooltipIndicatorInner {...props} />;
}

function TooltipIndicatorInner({
    x,
    visible,
    height,
    animate,
}: TooltipIndicatorProps) {
    const rectX = x - 0.5;
    const animatedX = useSpring(rectX, TOOLTIP_SPRING);

    if (animate) {
        animatedX.set(rectX);
    }

    // biome-ignore lint/correctness/useExhaustiveDependencies: we need to jump the animatedX when the visible prop changes
    useEffect(() => {
        animatedX.set(rectX);
    }, [animatedX, visible]);

    return (
        <g>
            <defs>
                <linearGradient
                    id="tooltip-indicator-gradient"
                    x1="0%"
                    x2="0%"
                    y1="0%"
                    y2="100%"
                >
                    <stop
                        offset="0%"
                        style={{
                            stopColor: vars.border.default,
                            stopOpacity: 0,
                        }}
                    />
                    <stop
                        offset="10%"
                        style={{
                            stopColor: vars.border.default,
                            stopOpacity: 1,
                        }}
                    />
                    <stop
                        offset="50%"
                        style={{
                            stopColor: vars.border.default,
                            stopOpacity: 1,
                        }}
                    />
                    <stop
                        offset="90%"
                        style={{
                            stopColor: vars.border.default,
                            stopOpacity: 1,
                        }}
                    />
                    <stop
                        offset="100%"
                        style={{
                            stopColor: vars.border.default,
                            stopOpacity: 0,
                        }}
                    />
                </linearGradient>
            </defs>
            {animate ? (
                <motion.rect
                    fill="url(#tooltip-indicator-gradient)"
                    height={height}
                    width={1}
                    x={animatedX}
                    y={0}
                />
            ) : (
                <rect
                    fill="url(#tooltip-indicator-gradient)"
                    height={height}
                    width={1}
                    x={rectX}
                    y={0}
                />
            )}
        </g>
    );
}

interface TooltipDotProps {
    x: number;
    y: number;
    color: string;
}

function TooltipDot({ x, y, color }: TooltipDotProps) {
    const animatedX = useSpring(x, TOOLTIP_SPRING);
    const animatedY = useSpring(y, TOOLTIP_SPRING);

    animatedX.set(x);
    animatedY.set(y);

    return (
        <motion.circle
            cx={animatedX}
            cy={animatedY}
            fill={color}
            r={5}
            stroke={vars.surface.background}
            strokeWidth={2}
        />
    );
}

interface DatePillTrackerProps {
    enabled: boolean;
    visible: boolean;
    labels: string[];
    currentIndex: number;
    xWithMargin: number;
    discreteInteraction: boolean;
}

// Inner-only-on-visible so `useSpring` initializes at the real cursor x
// instead of `margin.left` on first hover.
function DatePillTracker(props: DatePillTrackerProps) {
    if (!(props.enabled && props.visible && props.labels.length > 0)) {
        return null;
    }
    return <DatePillTrackerInner {...props} />;
}

function DatePillTrackerInner({
    labels,
    currentIndex,
    xWithMargin,
    discreteInteraction,
    visible,
}: DatePillTrackerProps) {
    const animatedX = useSpring(xWithMargin, TOOLTIP_SPRING);

    if (!discreteInteraction) {
        animatedX.set(xWithMargin);
    }

    // biome-ignore lint/correctness/useExhaustiveDependencies: we need to jump the animatedX when the visible prop changes
    useEffect(() => {
        animatedX.set(xWithMargin);
    }, [animatedX, visible]);

    return (
        <motion.div
            className={styles.floating}
            style={{
                left: discreteInteraction ? xWithMargin : animatedX,
                transform: "translateX(-50%)",
                bottom: 4,
            }}
        >
            <DateTicker currentIndex={currentIndex} labels={labels} />
        </motion.div>
    );
}
