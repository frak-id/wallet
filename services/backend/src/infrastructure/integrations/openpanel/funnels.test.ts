import { describe, expect, it } from "vitest";
import type { OpenPanelChartSerie } from "./config";
import {
    aggregateFunnelSteps,
    buildFunnelSeries,
    type FunnelStepDefinition,
    serieCount,
    seriePreviousCount,
    seriePreviousSum,
    serieSum,
} from "./funnels";

/**
 * Build a response serie at request position `index` (0 → "A", 1 → "B", …)
 * with the given current/previous sums. OpenPanel encodes the original
 * request slot in `event.id` as a single sequential letter.
 */
function serieAt(
    index: number,
    sum: number,
    previousSum?: number
): OpenPanelChartSerie {
    const letter = String.fromCharCode("A".charCodeAt(0) + index);
    return {
        id: letter,
        names: [letter],
        event: { id: letter, name: `event_${letter}` },
        metrics: {
            sum,
            average: 0,
            min: 0,
            max: 0,
            ...(previousSum === undefined
                ? {}
                : {
                      previous: {
                          sum: {
                              value: previousSum,
                              diff: null,
                              state: "neutral",
                          },
                          average: { value: 0, diff: null, state: "neutral" },
                          min: { value: 0, diff: null, state: "neutral" },
                          max: { value: 0, diff: null, state: "neutral" },
                      },
                  }),
        },
        data: [],
    };
}

describe("buildFunnelSeries", () => {
    it("expands each event name into its own series, preserving order", () => {
        const definitions: FunnelStepDefinition[] = [
            { kind: "a", eventNames: ["e1"] },
            { kind: "b", eventNames: ["e2", "e3"] },
        ];
        const base = {
            name: "properties.merchant_id",
            operator: "is" as const,
            value: ["m1"],
        };

        const series = buildFunnelSeries(definitions, [base]);

        expect(series.map((s) => s.name)).toEqual(["e1", "e2", "e3"]);
        expect(series.every((s) => s.filters?.includes(base))).toBe(true);
    });

    it("appends a step's extraFilters on top of the base filters", () => {
        const base = {
            name: "properties.merchant_id",
            operator: "is" as const,
            value: ["m1"],
        };
        const extra = {
            name: "properties.source",
            operator: "is" as const,
            value: ["x"],
        };

        const series = buildFunnelSeries(
            [{ kind: "a", eventNames: ["e1"], extraFilters: [extra] }],
            [base]
        );

        expect(series[0]?.filters).toEqual([base, extra]);
    });
});

describe("aggregateFunnelSteps", () => {
    it("reads results back by request position, not response order", () => {
        const definitions: FunnelStepDefinition[] = [
            { kind: "step1", eventNames: ["e1"] },
            { kind: "step2", eventNames: ["e2"] },
        ];
        // Response is re-sorted by sum descending — step2 (B) comes first.
        const response = [serieAt(1, 50), serieAt(0, 10)];

        const result = aggregateFunnelSteps(definitions, response);

        expect(result).toEqual([
            { kind: "step1", value: 10, previousValue: 0 },
            { kind: "step2", value: 50, previousValue: 0 },
        ]);
    });

    it("sums multiple event names into a single step", () => {
        const definitions: FunnelStepDefinition[] = [
            { kind: "combined", eventNames: ["e1", "e2"] },
        ];
        const response = [serieAt(0, 7, 3), serieAt(1, 5, 2)];

        expect(aggregateFunnelSteps(definitions, response)).toEqual([
            { kind: "combined", value: 12, previousValue: 5 },
        ]);
    });

    it("treats a dropped (zero-sum) serie as 0", () => {
        const definitions: FunnelStepDefinition[] = [
            { kind: "a", eventNames: ["e1"] },
            { kind: "b", eventNames: ["e2"] },
        ];
        // OpenPanel omits the zero-sum serie entirely (no "B").
        const response = [serieAt(0, 4)];

        expect(aggregateFunnelSteps(definitions, response)).toEqual([
            { kind: "a", value: 4, previousValue: 0 },
            { kind: "b", value: 0, previousValue: 0 },
        ]);
    });
});

describe("serieSum / seriePreviousSum", () => {
    it("returns 0 for an undefined serie", () => {
        expect(serieSum(undefined)).toBe(0);
        expect(seriePreviousSum(undefined)).toBe(0);
    });

    it("coerces a non-finite sum to 0 (NaN would 422 the endpoint)", () => {
        const broken = {
            metrics: { sum: Number.NaN },
        } as unknown as OpenPanelChartSerie;
        expect(serieSum(broken)).toBe(0);
    });

    it("returns 0 previous when the previous block is absent", () => {
        expect(seriePreviousSum(serieAt(0, 9))).toBe(0);
    });
});

describe("serieCount / seriePreviousCount", () => {
    it("returns 0 for an undefined serie", () => {
        expect(serieCount(undefined)).toBe(0);
        expect(seriePreviousCount(undefined)).toBe(0);
    });

    it("reads metrics.count and metrics.previous.count.value", () => {
        const serie = {
            metrics: {
                sum: 12,
                average: 0,
                min: 0,
                max: 0,
                count: 5,
                previous: {
                    sum: { value: 8, diff: null, state: "neutral" },
                    average: { value: 0, diff: null, state: "neutral" },
                    min: { value: 0, diff: null, state: "neutral" },
                    max: { value: 0, diff: null, state: "neutral" },
                    count: { value: 3, diff: null, state: "neutral" },
                },
            },
        } as unknown as OpenPanelChartSerie;

        expect(serieCount(serie)).toBe(5);
        expect(seriePreviousCount(serie)).toBe(3);
    });

    it("returns 0 count when metrics.count is absent", () => {
        expect(serieCount(serieAt(0, 9))).toBe(0);
        expect(seriePreviousCount(serieAt(0, 9))).toBe(0);
    });
});
