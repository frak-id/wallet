import {
    PIE_HOVER_OFFSET,
    PIE_INNER_RADIUS,
    PIE_OUTER_RADIUS,
    usePie,
} from "./pie-context";

const MIN_FRACTION = 0.05;

/**
 * Percentage labels centred on each pie/donut slice, rendered from the same
 * arc data the slices use.
 */
export function PieSliceLabels() {
    const { arcs, totalValue, hoveredIndex } = usePie();

    if (totalValue <= 0) {
        return null;
    }

    const radius = (PIE_INNER_RADIUS + PIE_OUTER_RADIUS) / 2;

    return (
        <>
            {arcs.map((arc) => {
                const fraction = arc.value / totalValue;
                if (fraction < MIN_FRACTION) {
                    return null;
                }
                const mid = (arc.startAngle + arc.endAngle) / 2;
                const x = Math.sin(mid) * radius;
                const y = -Math.cos(mid) * radius;
                // Follow the slice's translate-on-hover so the label rides with it.
                const isHovered = hoveredIndex === arc.index;
                const isFaded = hoveredIndex !== null && !isHovered;
                const dx = isHovered ? Math.sin(mid) * PIE_HOVER_OFFSET : 0;
                const dy = isHovered ? -Math.cos(mid) * PIE_HOVER_OFFSET : 0;
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
                            fill="#ffffff"
                            fillOpacity={isFaded ? 0.4 : 1}
                            fontSize={11}
                            fontWeight={600}
                            pointerEvents="none"
                            style={{ transition: "fill-opacity 150ms ease" }}
                            textAnchor="middle"
                            x={x}
                            y={y}
                        >
                            {`${Math.round(fraction * 100)}%`}
                        </text>
                    </g>
                );
            })}
        </>
    );
}

PieSliceLabels.displayName = "PieSliceLabels";
