import { useChartStable } from "./chart-context";

export interface ReferenceLineProps {
    /** Y value (in data units) at which to draw the horizontal line. */
    y: number;
    /** Optional label drawn in the right gutter. Use "\n" for multiple lines. */
    label?: string;
    /** Line + label color. Default: var(--chart-line-primary) */
    color?: string;
}

/**
 * Horizontal reference line (e.g. an average) drawn across the plot in data
 * coordinates, with an optional label in the right margin. bklit has no
 * built-in reference line.
 */
export function ReferenceLine({
    y,
    label,
    color = "var(--chart-line-primary)",
}: ReferenceLineProps) {
    const { yScale, innerWidth } = useChartStable();
    const yy = yScale(y);
    const lines = label ? label.split("\n") : [];

    return (
        <g>
            <line
                stroke={color}
                strokeDasharray="4 4"
                strokeWidth={1}
                x1={0}
                x2={innerWidth}
                y1={yy}
                y2={yy}
            />
            {lines.length > 0 ? (
                <text
                    fill={color}
                    fontSize={11}
                    fontWeight={500}
                    x={innerWidth + 4}
                    y={yy}
                >
                    {lines.map((line, i) => (
                        <tspan
                            dy={
                                i === 0
                                    ? `${(lines.length - 1) * -0.55 + 0.32}em`
                                    : "1.1em"
                            }
                            key={line}
                            x={innerWidth + 4}
                        >
                            {line}
                        </tspan>
                    ))}
                </text>
            ) : null}
        </g>
    );
}

ReferenceLine.displayName = "ReferenceLine";

export default ReferenceLine;
