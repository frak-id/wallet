/**
 * Shared types for the OpenPanel `/export/*` API.
 *
 * Public docs: https://openpanel.dev/docs/api/export
 * Source schema (`chartSchemeFull`): packages/validation in
 * https://github.com/Openpanel-dev/openpanel — picks `breakdowns`, `interval`,
 * `range`, `previous`, `startDate`, `endDate` from `zReport` and adds a typed
 * `series` array.
 *
 * Only the subset used by `CampaignAnalyticsOrchestrator` is modelled here.
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

export type OpenPanelChartSerieDatum = {
    date: string;
    count: number;
    /** Present when `previous: true` was requested. */
    previousCount?: number;
};

export type OpenPanelChartSerie = {
    name: string;
    /**
     * Optional breakdown bucket label. Present when the request carried
     * `breakdowns` — OpenPanel emits one serie per breakdown value with the
     * value surfaced as `event` (typically the property value, e.g. `"ios"`).
     */
    event?: string;
    total: number;
    previousTotal?: number;
    data: OpenPanelChartSerieDatum[];
};

export type OpenPanelChartResponse = {
    series: OpenPanelChartSerie[];
};
