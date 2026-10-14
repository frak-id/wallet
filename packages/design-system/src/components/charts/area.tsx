import { curveMonotoneX } from "@visx/curve";
import { AreaClosed, LinePath } from "@visx/shape";
import { useCallback, useId, useRef } from "react";
import { useChartStable } from "./chart-context";
import { SeriesHighlightLayer } from "./series-highlight-layer";
import { SeriesHoverDim } from "./series-hover-dim";

export interface AreaProps {
    /** Key in data to use for y values */
    dataKey: string;
    /** Fill color for the area gradient start */
    fill: string;
    /** Stroke color for the line */
    stroke: string;
}

export function Area({ dataKey, fill, stroke }: AreaProps) {
    // Stable slice only: hover state lives inside `<SeriesHoverDim>` and
    // `<SeriesHighlightLayer>` so this component does not re-render on cursor
    // motion.
    const { renderData, xScale, yScale, innerHeight, xAccessor } =
        useChartStable();

    const pathRef = useRef<SVGPathElement>(null);

    const uniqueId = useId();
    const gradientId = `area-gradient-${dataKey}-${uniqueId}`;

    const getY = useCallback(
        (d: Record<string, unknown>) => {
            const value = d[dataKey];
            return typeof value === "number" ? (yScale(value) ?? 0) : 0;
        },
        [dataKey, yScale]
    );

    return (
        <>
            <defs>
                <linearGradient
                    id={gradientId}
                    x1="0%"
                    x2="0%"
                    y1="0%"
                    y2="100%"
                >
                    <stop
                        offset="0%"
                        style={{ stopColor: fill, stopOpacity: 0.4 }}
                    />
                    <stop
                        offset="100%"
                        style={{ stopColor: fill, stopOpacity: 0 }}
                    />
                </linearGradient>
            </defs>

            <SeriesHoverDim>
                <g>
                    <AreaClosed
                        curve={curveMonotoneX}
                        data={renderData}
                        fill={`url(#${gradientId})`}
                        x={(d) => xScale(xAccessor(d)) ?? 0}
                        y={getY}
                        yScale={yScale}
                    />
                </g>

                <LinePath
                    curve={curveMonotoneX}
                    data={renderData}
                    innerRef={pathRef}
                    stroke={stroke}
                    strokeLinecap="round"
                    strokeWidth={2}
                    x={(d) => xScale(xAccessor(d)) ?? 0}
                    y={getY}
                />
            </SeriesHoverDim>

            <SeriesHighlightLayer
                height={innerHeight}
                pathRef={pathRef}
                stroke={stroke}
            />
        </>
    );
}

Area.displayName = "Area";
