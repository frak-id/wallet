/**
 * Shared types for the OpenPanel `/export/*` API.
 *
 * Public docs: https://openpanel.dev/docs/api/export
 * Source: `apps/api/src/controllers/export.controller.ts` (`chartSchemeFull`)
 * and `packages/db/src/engine/format.ts` (`format()`) in
 * https://github.com/Openpanel-dev/openpanel.
 *
 * Response shape sanity:
 *   - Per-serie totals live under `metrics.sum` (NOT a top-level `total`).
 *   - Previous-period values live under `metrics.previous.{sum,…}.value`
 *     (NOT a top-level `previousTotal`). The whole `previous` object is
 *     omitted when the matching previous-window serie has no data — not
 *     zeroed. Read with `?.value ?? 0`.
 *   - Per-datapoint previous lives under `data[i].previous.value` (NOT a
 *     `previousCount` field).
 *   - Breakdown values live under `event.breakdowns[breakdownKey]` — the
 *     key matches what the request sent (e.g. `"properties.source"`,
 *     `"device"`). One serie emitted per (event × breakdown value) tuple.
 *
 * Only the subset used by `CampaignOverviewOrchestrator.getAnalytics` is modelled here.
 */

export type OpenPanelChartInterval =
    | "minute"
    | "hour"
    | "day"
    | "week"
    | "month";

export type OpenPanelChartRange =
    | "1h"
    | "24h"
    | "7d"
    | "14d"
    | "30d"
    | "lastHour"
    | "today"
    | "yesterday"
    | "7days"
    | "30days"
    | "monthToDate"
    | "lastMonth"
    | "custom";

export type OpenPanelFilterOperator =
    | "is"
    | "isNot"
    | "contains"
    | "doesNotContain"
    | "startsWith"
    | "endsWith";

export type OpenPanelChartFilter = {
    name: string;
    operator: OpenPanelFilterOperator;
    value: string[];
};

/**
 * Per-series aggregation. `event` (default) counts events, `user` counts
 * distinct profiles (anonymous-id-derived), `session` counts distinct
 * sessions, `group` counts distinct groups. Mirrors OpenPanel's
 * `zChartEventSegment` enum.
 */
export type OpenPanelChartSegment =
    | "event"
    | "user"
    | "session"
    | "group"
    | "user_average";

export type OpenPanelChartSeries = {
    /** Event name to aggregate. Use `"*"` to count every event. */
    name: string;
    filters?: OpenPanelChartFilter[];
    /** Aggregation segment — omit for total events. */
    segment?: OpenPanelChartSegment;
};

export type OpenPanelChartBreakdown = {
    name: string;
};

export type OpenPanelChartQuery = {
    projectId: string;
    series: OpenPanelChartSeries[];
    /**
     * ISO 8601 timestamps. When provided, `range` must be `"custom"` (the
     * orchestrator always sets these together).
     */
    startDate: string;
    endDate: string;
    range?: OpenPanelChartRange;
    interval?: OpenPanelChartInterval;
    /** Adds a `previous` field on every datapoint when true. */
    previous?: boolean;
    breakdowns?: OpenPanelChartBreakdown[];
};

/**
 * Previous-period comparison wrapper attached to both per-serie metrics
 * and per-bucket data points when `previous: true` is requested.
 * `value` is the raw previous-period count; `diff` is the percent change
 * (null when the previous value was 0 or identical). `state` reflects the
 * direction OpenPanel surfaces in its own UI.
 */
export type OpenPanelPreviousValue = {
    value: number;
    diff: number | null;
    state: "positive" | "negative" | "neutral";
};

export type OpenPanelChartSerieDatum = {
    date: string;
    count: number;
    /** Present when `previous: true` AND the previous-window serie has data. */
    previous?: OpenPanelPreviousValue;
};

export type OpenPanelChartSerieMetrics = {
    sum: number;
    average: number;
    min: number;
    max: number;
    count?: number;
    /** Present when `previous: true` AND the previous-window serie has data. */
    previous?: {
        sum: OpenPanelPreviousValue;
        average: OpenPanelPreviousValue;
        min: OpenPanelPreviousValue;
        max: OpenPanelPreviousValue;
        count?: OpenPanelPreviousValue;
    };
};

export type OpenPanelChartSerieEvent = {
    id: string;
    name: string;
    /**
     * Breakdown bucket values, keyed by the breakdown name sent in the
     * request (e.g. `"properties.source"`, `"device"`). One serie is
     * emitted per (event × breakdown value) tuple.
     */
    breakdowns?: Record<string, string>;
};

export type OpenPanelChartSerie = {
    id: string;
    names: string[];
    event: OpenPanelChartSerieEvent;
    metrics: OpenPanelChartSerieMetrics;
    data: OpenPanelChartSerieDatum[];
};

export type OpenPanelChartResponse = {
    series: OpenPanelChartSerie[];
};
