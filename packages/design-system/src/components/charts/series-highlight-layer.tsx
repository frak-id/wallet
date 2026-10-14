import { useSpring } from "motion/react";
import { type RefObject, useMemo, useRef } from "react";
import { useChartHover, useChartStable } from "./chart-context";
import { HighlightSegment } from "./highlight-segment";
import { computeSegmentBounds } from "./highlight-segment-bounds";

const HIGHLIGHT_SPRING = { stiffness: 180, damping: 28 };

interface SeriesHighlightLayerProps {
    height: number;
    pathRef: RefObject<SVGPathElement | null>;
    stroke: string;
}

/**
 * Self-contained hover-highlight band over a series stroke.
 *
 * Owns the hover subscription so the parent <Area> can stay on the stable
 * slice. This component still re-renders on hover — a tiny leaf, so the cost
 * is bounded to itself.
 */
export function SeriesHighlightLayer({
    height,
    pathRef,
    stroke,
}: SeriesHighlightLayerProps) {
    const { data, xScale, xAccessor, isLoaded } = useChartStable();
    const { tooltipData, selection } = useChartHover();

    const bounds = useMemo(
        () =>
            computeSegmentBounds(
                data,
                xScale,
                xAccessor,
                tooltipData,
                selection
            ),
        [data, xScale, xAccessor, tooltipData, selection]
    );

    const xSpring = useSpring(0, HIGHLIGHT_SPRING);
    const widthSpring = useSpring(0, HIGHLIGHT_SPRING);

    // Jump on inactive→active so the band appears at the hovered point instead
    // of sliding in from x=0; ease on subsequent moves.
    const wasActive = useRef(false);
    if (bounds.isActive && !wasActive.current) {
        xSpring.jump(bounds.x);
        widthSpring.jump(bounds.width);
    } else {
        xSpring.set(bounds.x);
        widthSpring.set(bounds.width);
    }
    wasActive.current = bounds.isActive;

    return (
        <HighlightSegment
            height={height}
            pathRef={pathRef}
            stroke={stroke}
            visible={bounds.isActive && isLoaded}
            width={widthSpring}
            x={xSpring}
        />
    );
}

SeriesHighlightLayer.displayName = "SeriesHighlightLayer";
