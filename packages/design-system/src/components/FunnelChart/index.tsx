import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { Bar } from "@visx/shape";
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

function FunnelBar({
    value,
    max,
    color,
    faded,
}: {
    value: number;
    max: number;
    color: string;
    faded: boolean;
}) {
    return (
        <ParentSize debounceTime={10}>
            {({ width }) => {
                if (width === 0) {
                    return null;
                }
                const xScale = scaleLinear({
                    domain: [0, max],
                    range: [0, width],
                });
                const barWidth = Math.max(xScale(value), MIN_BAR_WIDTH);
                return (
                    <svg
                        aria-hidden="true"
                        height={BAR_HEIGHT}
                        style={{ display: "block" }}
                        width="100%"
                    >
                        <Bar
                            fill={color}
                            fillOpacity={faded ? 0.4 : 1}
                            height={BAR_HEIGHT}
                            rx={BAR_RADIUS}
                            style={{ transition: "fill-opacity 150ms ease" }}
                            width={barWidth}
                            x={0}
                            y={0}
                        />
                    </svg>
                );
            }}
        </ParentSize>
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
        <div className={funnelChartStyles.container}>
            <div className={funnelChartStyles.guides} aria-hidden>
                <span className={funnelChartStyles.guide} />
            </div>
            {steps.map((step, i) => {
                const isLast = i === lastIndex;
                return (
                    <div
                        className={funnelChartStyles.row}
                        key={step.label}
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                    >
                        <span className={funnelChartStyles.label}>
                            {step.label}
                        </span>
                        <div className={funnelChartStyles.track}>
                            <FunnelBar
                                color={
                                    isLast
                                        ? vars.icon.success
                                        : vars.icon.action
                                }
                                faded={
                                    hoveredIndex !== null && hoveredIndex !== i
                                }
                                max={max}
                                value={step.value}
                            />
                        </div>
                        <div className={funnelChartStyles.valueCell}>
                            <span
                                className={`${funnelChartStyles.value}${
                                    isLast
                                        ? ` ${funnelChartStyles.valueSuccess}`
                                        : ""
                                }`}
                            >
                                {valueFormatter(step.value)}
                            </span>
                            {step.delta !== undefined && (
                                <span
                                    className={`${funnelChartStyles.delta} ${
                                        step.delta >= 0
                                            ? funnelChartStyles.deltaUp
                                            : funnelChartStyles.deltaDown
                                    }`}
                                >
                                    {step.delta >= 0 ? "▲" : "▼"}{" "}
                                    {step.delta > 0 ? "+" : ""}
                                    {step.delta}%
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
