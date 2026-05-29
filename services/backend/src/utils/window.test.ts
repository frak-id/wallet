import { describe, expect, it } from "vitest";
import { endOfIsoDay, resolveWindow, startOfIsoDay } from "./window";

describe("startOfIsoDay / endOfIsoDay", () => {
    it("anchors a date to the start of the UTC day", () => {
        expect(startOfIsoDay("2026-05-29").toISOString()).toBe(
            "2026-05-29T00:00:00.000Z"
        );
    });

    it("anchors a date to the end of the UTC day", () => {
        expect(endOfIsoDay("2026-05-29").toISOString()).toBe(
            "2026-05-29T23:59:59.999Z"
        );
    });
});

describe("resolveWindow", () => {
    it("treats a missing `from` as a lifetime window with no comparison", () => {
        const resolved = resolveWindow({});

        expect(resolved.hasComparison).toBe(false);
        // Lower edge sits at the epoch so PG BETWEEN degenerates to open.
        expect(resolved.current.from).toEqual(new Date(0));
        // Previous collapses to an empty epoch range → FILTER aggregates = 0.
        expect(resolved.previous.from).toEqual(new Date(0));
        expect(resolved.previous.to).toEqual(new Date(0));
    });

    it("uses `now` as the upper edge when `to` is omitted", () => {
        const before = Date.now();
        const resolved = resolveWindow({ from: "2026-05-01" });
        const after = Date.now();

        expect(resolved.current.from.toISOString()).toBe(
            "2026-05-01T00:00:00.000Z"
        );
        expect(resolved.current.to.getTime()).toBeGreaterThanOrEqual(before);
        expect(resolved.current.to.getTime()).toBeLessThanOrEqual(after);
    });

    it("builds a same-length trailing previous window ending 1ms before `from`", () => {
        const resolved = resolveWindow({
            from: "2026-05-08",
            to: "2026-05-14",
        });

        expect(resolved.hasComparison).toBe(true);

        const { current, previous } = resolved;
        const currentLength = current.to.getTime() - current.from.getTime();
        const previousLength = previous.to.getTime() - previous.from.getTime();

        // 1ms boundary gap prevents double-counting rows on the edge.
        expect(previous.to.getTime()).toBe(current.from.getTime() - 1);
        // Same span on both halves.
        expect(previousLength).toBe(currentLength);
    });

    it("floors a sub-day window to a one-day comparison span", () => {
        const resolved = resolveWindow({
            from: "2026-05-08",
            to: "2026-05-08",
        });

        const DAY_MS = 24 * 60 * 60 * 1000;
        const previousLength =
            resolved.previous.to.getTime() - resolved.previous.from.getTime();
        expect(previousLength).toBe(DAY_MS);
    });
});
