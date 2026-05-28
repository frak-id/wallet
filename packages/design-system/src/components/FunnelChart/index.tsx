import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { motion } from "motion/react";
import { useState } from "react";
import { vars } from "../../theme.css";
import { funnelChartStyles } from "./funnelChart.css";

export type FunnelStep = {
    label: string;
    value: number;
    delta?: number;
};

type FunnelChartProps = {
    steps: FunnelStep[];
    valueFormatter?: (value: number) => string;
};

const defaultFormatter = (n: number) =>
    n.toLocaleString("en-US").replace(/,/g, " ");

const BAR_HEIGHT = 16;
const BAR_RADIUS = 2;
const MIN_BAR_WIDTH = 4;
// Mirrors the `120px 1fr 96px` grid + 2× `spacing.m` (16px) gaps in the css,
// so the bar's linear scale uses the real track-column width.
const LABEL_COL = 120;
const VALUE_COL = 96;
const COLUMN_GAP = 16;

function FunnelBar({
    value,
    max,
    color,
    faded,
    trackWidth,
}: {
    value: number;
    max: number;
    color: string;
    faded: boolean;
    trackWidth: number;
}) {
    const xScale = scaleLinear({
        domain: [0, max],
        range: [0, Math.max(trackWidth, 0)],
    });
    const barWidth = Math.max(xScale(value), MIN_BAR_WIDTH);
    return (
        <svg
            aria-hidden="true"
            height={BAR_HEIGHT}
            style={{ display: "block" }}
            width="100%"
        >
            <motion.rect
                animate={{ width: barWidth }}
                fill={color}
                fillOpacity={faded ? 0.4 : 1}
                height={BAR_HEIGHT}
                initial={{ width: 0 }}
                rx={BAR_RADIUS}
                style={{ transition: "fill-opacity 150ms ease" }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                x={0}
                y={0}
            />
        </svg>
    );
}

function FunnelDelta({ delta }: { delta: number }) {
    const positive = delta >= 0;
    return (
        <span
            className={`${funnelChartStyles.delta} ${
                positive
                    ? funnelChartStyles.deltaUp
                    : funnelChartStyles.deltaDown
            }`}
        >
            {positive ? "▲" : "▼"} {delta > 0 ? "+" : ""}
            {delta}%
        </span>
    );
}

function FunnelRow({
    step,
    isLast,
    faded,
    max,
    trackWidth,
    valueFormatter,
    onHover,
}: {
    step: FunnelStep;
    isLast: boolean;
    faded: boolean;
    max: number;
    trackWidth: number;
    valueFormatter: (value: number) => string;
    onHover: (hovered: boolean) => void;
}) {
    return (
        <div
            className={funnelChartStyles.row}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
        >
            <span className={funnelChartStyles.label}>{step.label}</span>
            <div className={funnelChartStyles.track}>
                <FunnelBar
                    color={isLast ? vars.icon.success : vars.icon.action}
                    faded={faded}
                    max={max}
                    trackWidth={trackWidth}
                    value={step.value}
                />
            </div>
            <div className={funnelChartStyles.valueCell}>
                <span
                    className={`${funnelChartStyles.value}${
                        isLast ? ` ${funnelChartStyles.valueSuccess}` : ""
                    }`}
                >
                    {valueFormatter(step.value)}
                </span>
                {step.delta !== undefined && <FunnelDelta delta={step.delta} />}
            </div>
        </div>
    );
}

export function FunnelChart({
    steps,
    valueFormatter = defaultFormatter,
}: FunnelChartProps) {
    const max = Math.max(...steps.map((s) => s.value), 1);
    const lastIndex = steps.length - 1;
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    return (
        <ParentSize debounceTime={10} parentSizeStyles={{ width: "100%" }}>
            {({ width }) => {
                const trackWidth =
                    width - LABEL_COL - VALUE_COL - 2 * COLUMN_GAP;
                return (
                    <div className={funnelChartStyles.container}>
                        <div className={funnelChartStyles.guides} aria-hidden>
                            <span className={funnelChartStyles.guide} />
                        </div>
                        {steps.map((step, i) => (
                            <FunnelRow
                                faded={
                                    hoveredIndex !== null && hoveredIndex !== i
                                }
                                isLast={i === lastIndex}
                                key={step.label}
                                max={max}
                                onHover={(hovered) =>
                                    setHoveredIndex(hovered ? i : null)
                                }
                                step={step}
                                trackWidth={trackWidth}
                                valueFormatter={valueFormatter}
                            />
                        ))}
                    </div>
                );
            }}
        </ParentSize>
    );
}
