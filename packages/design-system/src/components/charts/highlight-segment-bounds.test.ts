import { describe, expect, it } from "vitest";
import { computeSegmentBounds } from "./highlight-segment-bounds";

const PX_PER_POINT = 10;
const data = Array.from({ length: 5 }, (_, i) => ({ x: i }));
const xAccessor = (d: Record<string, unknown>) => new Date(d.x as number);
const xScale = (date: Date) => date.getTime() * PX_PER_POINT;

const inactive = { x: 0, width: 0, isActive: false };

function bounds(
    tooltipIndex: number | null,
    selection?: { active: boolean; startX: number; endX: number },
    points: Record<string, unknown>[] = data
) {
    return computeSegmentBounds(
        points,
        xScale,
        xAccessor,
        tooltipIndex === null ? null : { index: tooltipIndex },
        selection
    );
}

describe("computeSegmentBounds", () => {
    it("is inactive without data", () => {
        expect(bounds(0, undefined, [])).toEqual(inactive);
    });

    it("is inactive without hover or selection", () => {
        expect(bounds(null)).toEqual(inactive);
    });

    it("spans one point either side of the hovered point", () => {
        expect(bounds(2)).toEqual({ x: 10, width: 20, isActive: true });
    });

    it("clamps to the first point at the left edge", () => {
        expect(bounds(0)).toEqual({ x: 0, width: 10, isActive: true });
    });

    it("clamps to the last point at the right edge", () => {
        expect(bounds(4)).toEqual({ x: 30, width: 10, isActive: true });
    });

    it("collapses to zero width on a single point", () => {
        expect(bounds(0, undefined, [{ x: 0 }])).toEqual({
            x: 0,
            width: 0,
            isActive: true,
        });
    });

    it("is inactive when the hovered index is far outside the data", () => {
        expect(bounds(99)).toEqual(inactive);
    });

    it("uses the dragged pixel range for an active selection", () => {
        expect(bounds(null, { active: true, startX: 12, endX: 37 })).toEqual({
            x: 12,
            width: 25,
            isActive: true,
        });
    });

    it("normalises a selection dragged right to left", () => {
        expect(bounds(null, { active: true, startX: 37, endX: 12 })).toEqual({
            x: 12,
            width: 25,
            isActive: true,
        });
    });

    it("lets an active selection win over hover", () => {
        expect(bounds(2, { active: true, startX: 5, endX: 8 })).toEqual({
            x: 5,
            width: 3,
            isActive: true,
        });
    });

    it("falls back to hover when the selection is not active", () => {
        expect(bounds(2, { active: false, startX: 5, endX: 8 })).toEqual({
            x: 10,
            width: 20,
            isActive: true,
        });
    });
});
