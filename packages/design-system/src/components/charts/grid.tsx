import { GridRows } from "@visx/grid";
import { useId } from "react";
import { vars } from "../../theme.css";
import { useChartStable } from "./chart-context";

/** Horizontal grid lines, faded at the left and right edges. */
export function Grid() {
    const { yScale, innerWidth, innerHeight } = useChartStable();

    const uniqueId = useId();

    const maskId = `grid-rows-fade-${uniqueId}`;
    const gradientId = `${maskId}-gradient`;

    return (
        <g>
            <defs>
                <linearGradient
                    id={gradientId}
                    x1="0%"
                    x2="100%"
                    y1="0%"
                    y2="0%"
                >
                    <stop
                        offset="0%"
                        style={{ stopColor: "white", stopOpacity: 0 }}
                    />
                    <stop
                        offset="10%"
                        style={{ stopColor: "white", stopOpacity: 1 }}
                    />
                    <stop
                        offset="90%"
                        style={{ stopColor: "white", stopOpacity: 1 }}
                    />
                    <stop
                        offset="100%"
                        style={{ stopColor: "white", stopOpacity: 0 }}
                    />
                </linearGradient>
                <mask id={maskId}>
                    <rect
                        fill={`url(#${gradientId})`}
                        height={innerHeight}
                        width={innerWidth}
                        x="0"
                        y="0"
                    />
                </mask>
            </defs>

            <g mask={`url(#${maskId})`}>
                <GridRows
                    numTicks={5}
                    scale={yScale}
                    stroke={vars.border.subtle}
                    strokeDasharray="4,4"
                    strokeOpacity={1}
                    strokeWidth={1}
                    width={innerWidth}
                />
            </g>
        </g>
    );
}

Grid.displayName = "Grid";
