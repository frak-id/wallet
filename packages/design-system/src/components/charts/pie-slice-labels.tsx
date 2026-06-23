import { usePie } from "./pie-context";

export interface PieSliceLabelsProps {
    /** Formats a slice's fraction (0–1) into its label. Default: rounded %. */
    formatter?: (fraction: number) => string;
    /** Label color. Default: white (sits on coloured slices). */
    color?: string;
    /** Hide labels for slices smaller than this fraction. Default: 0.05 */
    minFraction?: number;
}

/**
 * Percentage labels centred on each pie/donut slice. bklit's PieSlice draws no
 * labels; the dashboard donut shows each segment's share, so we render them
 * from the same arc data the slices use.
 */
export function PieSliceLabels({
    formatter = (f) => `${Math.round(f * 100)}%`,
    color = "#ffffff",
    minFraction = 0.05,
}: PieSliceLabelsProps) {
    const {
        arcs,
        innerRadius,
        outerRadius,
        totalValue,
        hoveredIndex,
        hoverOffset,
    } = usePie();

    if (totalValue <= 0) {
        return null;
    }

    const radius = (innerRadius + outerRadius) / 2;

    return (
        <>
            {arcs.map((arc) => {
                const fraction = arc.value / totalValue;
                if (fraction < minFraction) {
                    return null;
                }
                const mid = (arc.startAngle + arc.endAngle) / 2;
                const x = Math.sin(mid) * radius;
                const y = -Math.cos(mid) * radius;
                // Follow the slice's translate-on-hover so the label rides with it.
                const isHovered = hoveredIndex === arc.index;
                const isFaded = hoveredIndex !== null && !isHovered;
                const dx = isHovered ? Math.sin(mid) * hoverOffset : 0;
                const dy = isHovered ? -Math.cos(mid) * hoverOffset : 0;
                return (
                    // Transform on a wrapping <g> (not <text>) — more robust
                    // across browsers (Safari) for animating SVG transforms.
                    <g
                        key={arc.index}
                        style={{
                            transform: `translate(${dx}px, ${dy}px)`,
                            transition: "transform 200ms ease",
                        }}
                    >
                        <text
                            dy="0.32em"
                            fill={color}
                            fillOpacity={isFaded ? 0.4 : 1}
                            fontSize={11}
                            fontWeight={600}
                            pointerEvents="none"
                            style={{ transition: "fill-opacity 150ms ease" }}
                            textAnchor="middle"
                            x={x}
                            y={y}
                        >
                            {formatter(fraction)}
                        </text>
                    </g>
                );
            })}
        </>
    );
}

PieSliceLabels.displayName = "PieSliceLabels";
