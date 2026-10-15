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

    const isDefined = useCallback(
        (d: Record<string, unknown>) => typeof d[dataKey] === "number",
        [dataKey]
    );

    const getY = useCallback(
        (d: Record<string, unknown>) => yScale(d[dataKey] as number) ?? 0,
        [dataKey, yScale]
    );

    // A value with no defined neighbour forms no line segment, so mark it.
    const lonePoints = renderData.filter(
        (d, i) =>
            isDefined(d) &&
            !(renderData[i - 1] && isDefined(renderData[i - 1])) &&
            !(renderData[i + 1] && isDefined(renderData[i + 1]))
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
                        defined={isDefined}
                        fill={`url(#${gradientId})`}
                        x={(d) => xScale(xAccessor(d)) ?? 0}
                        y={getY}
                        yScale={yScale}
                    />
                </g>

                <LinePath
                    curve={curveMonotoneX}
                    data={renderData}
                    defined={isDefined}
                    innerRef={pathRef}
                    stroke={stroke}
                    strokeLinecap="round"
                    strokeWidth={2}
                    x={(d) => xScale(xAccessor(d)) ?? 0}
                    y={getY}
                />
                {lonePoints.map((d) => (
                    <circle
                        cx={xScale(xAccessor(d)) ?? 0}
                        cy={getY(d)}
                        fill={stroke}
                        key={xAccessor(d).getTime()}
                        r={3}
                    />
                ))}
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
