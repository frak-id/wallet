import type { TooltipData } from "./chart-context";
import type { ChartSelection } from "./use-chart-interaction";

// The band is the pixel x-range one data point either side of the hovered point:
//   [ xScale(t(idx-1)), xScale(t(idx+1)) ]
// `<HighlightSegment>` re-strokes the base path clipped to that band. Selecting
// the band by data index assumes x is monotone along the path (true for a time
// series).

interface SegmentBounds {
    /** Left edge of the highlight band, in pixels. */
    x: number;
    /** Width of the highlight band, in pixels. */
    width: number;
    isActive: boolean;
}

const INACTIVE_SEGMENT: SegmentBounds = {
    x: 0,
    width: 0,
    isActive: false,
};

/**
 * The highlight band `{x, width}` in pixel space, from the data + `xScale` plus
 * the current hover/selection. Hover spans one data point either side of the dot
 * (clamped to the ends); an active drag-selection uses the dragged pixel range
 * directly and takes priority over hover.
 */
export function computeSegmentBounds(
    data: Record<string, unknown>[],
    xScale: (value: Date) => number | undefined,
    xAccessor: (d: Record<string, unknown>) => Date,
    tooltipData: Pick<TooltipData, "index"> | null | undefined,
    selection:
        | Pick<ChartSelection, "active" | "startX" | "endX">
        | null
        | undefined
): SegmentBounds {
    if (data.length === 0) {
        return INACTIVE_SEGMENT;
    }

    if (selection?.active) {
        const x = Math.min(selection.startX, selection.endX);
        const width = Math.abs(selection.endX - selection.startX);
        return { x, width, isActive: true };
    }

    if (!tooltipData) {
        return INACTIVE_SEGMENT;
    }

    const idx = tooltipData.index;
    const startIdx = Math.max(0, idx - 1);
    const endIdx = Math.min(data.length - 1, idx + 1);
    const startPoint = data[startIdx];
    const endPoint = data[endIdx];
    if (!(startPoint && endPoint)) {
        return INACTIVE_SEGMENT;
    }

    const startX = xScale(xAccessor(startPoint)) ?? 0;
    const endX = xScale(xAccessor(endPoint)) ?? 0;
    return { x: startX, width: Math.max(0, endX - startX), isActive: true };
}
