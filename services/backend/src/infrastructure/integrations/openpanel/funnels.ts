import type {
    OpenPanelChartFilter,
    OpenPanelChartSerie,
    OpenPanelChartSeries,
} from "./config";

/**
 * OpenPanel chart-construction + response-parsing helpers shared by any
 * orchestrator that builds multi-step funnels or KPI panels off
 * OpenPanel events. Pure: no domain or orchestration imports.
 *
 * Callers describe their funnel as a list of {@link FunnelStepDefinition}
 * (each step may sum several events) and feed the result of
 * `getChart(...).series` through {@link aggregateFunnelSteps} to get a
 * positional, NaN-safe `{ value, previousValue }` per step.
 */

/**
 * Per-step funnel definition.
 *
 * `eventNames` may carry multiple OpenPanel events whose counts are
 * summed for the step (e.g. `sharing_link_started + sharing_link_copied
 * → share_initiated`). `kind` is an opaque caller-defined identifier —
 * the helper never inspects it, only passes it through to the
 * aggregated output.
 *
 * `extraFilters` are appended to every series request built for the
 * step (on top of any merchant/scope filter the caller supplies via
 * {@link buildFunnelSeries}'s `baseFilters` argument).
 */
export type FunnelStepDefinition<Kind extends string = string> = {
    kind: Kind;
    eventNames: string[];
    extraFilters?: OpenPanelChartFilter[];
};

/**
 * Aggregated funnel step result. Positional `{value, previousValue}`
 * pair keyed by the caller's opaque `kind`. `previousValue` is `0`
 * when the chart request did not include `previous: true`.
 */
export type FunnelStepResult<Kind extends string = string> = {
    kind: Kind;
    value: number;
    previousValue: number;
};

/**
 * Build the OpenPanel `series` payload for a list of funnel step
 * definitions. Each step expands into one series per event name,
 * preserving the request order so the positional aggregators below
 * can read results back by index.
 *
 * `baseFilters` are applied to every series (typical use:
 * merchant scope, environment scope).
 */
export function buildFunnelSeries(
    definitions: FunnelStepDefinition[],
    baseFilters: OpenPanelChartFilter[]
): OpenPanelChartSeries[] {
    return definitions.flatMap((step) =>
        step.eventNames.map((event) => ({
            name: event,
            filters: [...baseFilters, ...(step.extraFilters ?? [])],
        }))
    );
}

/**
 * Aggregate an OpenPanel response back into one `FunnelStepResult`
 * per definition, in the same order the steps were declared.
 *
 * Sums the series outputs for each step's `eventNames` and pulls the
 * previous-window value when present. The mapping from request slot
 * to response serie is reconstructed by {@link indexByRequestPosition}.
 */
export function aggregateFunnelSteps<Kind extends string>(
    definitions: FunnelStepDefinition<Kind>[],
    responseSeries: OpenPanelChartSerie[]
): FunnelStepResult<Kind>[] {
    const indexed = indexByRequestPosition(responseSeries);
    let position = 0;
    return definitions.map((step) => {
        let value = 0;
        let previousValue = 0;
        for (let i = 0; i < step.eventNames.length; i++) {
            const serie = indexed.get(position++);
            value += serieSum(serie);
            previousValue += seriePreviousSum(serie);
        }
        return { kind: step.kind, value, previousValue };
    });
}

/**
 * Index returned series by their original request position.
 *
 * OpenPanel does NOT preserve request order in its response — it drops
 * zero-sum series entirely and sorts the rest by `sum` descending.
 * Each returned serie carries `event.id` as a single sequential letter
 * (`"A"`, `"B"`, …) reflecting its 0-based position in the request.
 * We invert that here so callers can read by index and get either the
 * matching serie or `undefined` (= zero).
 */
function indexByRequestPosition(
    responseSeries: OpenPanelChartSerie[]
): Map<number, OpenPanelChartSerie> {
    const indexed = new Map<number, OpenPanelChartSerie>();
    for (const serie of responseSeries) {
        const id = serie.event?.id;
        if (typeof id !== "string" || id.length === 0) continue;
        const position = id.charCodeAt(0) - "A".charCodeAt(0);
        if (position >= 0) indexed.set(position, serie);
    }
    return indexed;
}

/**
 * Defensive readers — coerce missing or non-finite values to 0.
 *
 * Elysia's TypeBox `t.Number()` validator rejects NaN (`AllowNaN`
 * defaults false), so a single malformed serie reaching the response
 * would turn the whole endpoint into a 422 — the error report shows
 * the offending value as `null` because `JSON.stringify(NaN) === "null"`.
 * `?? 0` alone is not sufficient because `??` only triggers on
 * `null`/`undefined`, not NaN.
 */
export function serieSum(serie: OpenPanelChartSerie | undefined): number {
    return finiteOrZero(serie?.metrics?.sum);
}

export function seriePreviousSum(
    serie: OpenPanelChartSerie | undefined
): number {
    return finiteOrZero(serie?.metrics?.previous?.sum.value);
}

/**
 * `metrics.count` is `uniq(profile_id)` over the whole range (NOT a
 * per-bucket sum) — the accurate distinct-actor count for a series.
 */
export function serieCount(serie: OpenPanelChartSerie | undefined): number {
    return finiteOrZero(serie?.metrics?.count);
}

export function seriePreviousCount(
    serie: OpenPanelChartSerie | undefined
): number {
    return finiteOrZero(serie?.metrics?.previous?.count?.value);
}

function finiteOrZero(value: number | undefined): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
