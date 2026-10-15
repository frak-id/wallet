import { describe, expect, it } from "vitest";
import {
    decimateTimeSeries,
    maxRenderPointsForWidth,
} from "./decimate-time-series";

type Point = { i: number; v: number };

function series(length: number, valueAt: (i: number) => number): Point[] {
    return Array.from({ length }, (_, i) => ({ i, v: valueAt(i) }));
}

describe("decimateTimeSeries", () => {
    it("returns the input untouched when it already fits the budget", () => {
        const data = series(10, (i) => i);

        expect(decimateTimeSeries(data, 10, ["v"])).toBe(data);
        expect(decimateTimeSeries(data, 50, ["v"])).toBe(data);
    });

    it("returns the input untouched when the budget is under 3 points", () => {
        const data = series(10, (i) => i);

        expect(decimateTimeSeries(data, 2, ["v"])).toBe(data);
    });

    it("returns an empty series as is", () => {
        const data: Point[] = [];

        expect(decimateTimeSeries(data, 64, ["v"])).toBe(data);
    });

    it("returns exactly the budgeted number of points", () => {
        const data = series(1000, (i) => Math.sin(i / 10));

        expect(decimateTimeSeries(data, 64, ["v"])).toHaveLength(64);
    });

    it("keeps the first and last points", () => {
        const data = series(500, (i) => i % 7);

        const sampled = decimateTimeSeries(data, 40, ["v"]);

        expect(sampled[0]).toBe(data[0]);
        expect(sampled.at(-1)).toBe(data.at(-1));
    });

    it("keeps points in their original order", () => {
        const data = series(500, (i) => (i * 37) % 101);

        const indexes = decimateTimeSeries(data, 40, ["v"]).map((p) => p.i);

        expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    });

    it("keeps an isolated spike in an otherwise flat series", () => {
        const data = series(300, (i) => (i === 123 ? 1000 : 0));

        const sampled = decimateTimeSeries(data, 30, ["v"]);

        expect(sampled.some((p) => p.v === 1000)).toBe(true);
    });

    it("never returns the same point twice", () => {
        const data = series(1000, (i) => Math.sin(i / 10));

        const indexes = decimateTimeSeries(data, 64, ["v"]).map((p) => p.i);

        expect(new Set(indexes).size).toBe(indexes.length);
    });

    it("keeps a spike in the first bucket", () => {
        const data = series(1000, (i) => (i === 5 ? 1000 : 0));

        const sampled = decimateTimeSeries(data, 64, ["v"]);

        expect(sampled.some((p) => p.v === 1000)).toBe(true);
    });

    it("only returns points taken from the input", () => {
        const data = series(200, (i) => i * i);

        const sampled = decimateTimeSeries(data, 25, ["v"]);

        for (const point of sampled) {
            expect(data).toContain(point);
        }
    });

    it("ignores value keys that are missing or non-numeric", () => {
        const data = series(200, (i) => (i === 80 ? 500 : 1)).map((p) => ({
            ...p,
            label: "x",
        }));

        const sampled = decimateTimeSeries(data, 20, ["v", "label", "absent"]);

        expect(sampled).toHaveLength(20);
        expect(sampled.some((p) => p.v === 500)).toBe(true);
    });
});

describe("maxRenderPointsForWidth", () => {
    it("never goes below 64 points", () => {
        expect(maxRenderPointsForWidth(0)).toBe(64);
        expect(maxRenderPointsForWidth(40)).toBe(64);
    });

    it("allows 1.5 points per pixel, rounded up", () => {
        expect(maxRenderPointsForWidth(100)).toBe(150);
        expect(maxRenderPointsForWidth(101)).toBe(152);
    });
});
