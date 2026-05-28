import type { OverviewWindowQuery } from "../schemas/campaignOverviewSchemas";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 30;

export type DateRange = { from: Date; to: Date };

/**
 * Same-length comparison window: `current` is the requested range,
 * `previous` is the trailing range of identical length ending 1ms
 * before `current.from`.
 */
export type ResolvedWindow = { current: DateRange; previous: DateRange };

/**
 * Resolve a request's `from`/`to` (yyyy-MM-dd) into the active range.
 * Falls back to a trailing `DEFAULT_WINDOW_DAYS` window when either
 * bound is absent. Used by orchestrators that don't need a comparison
 * window (e.g. the OpenPanel analytics endpoint where `previous: true`
 * is handled inside the chart request).
 */
export function resolveRange(window: OverviewWindowQuery): DateRange {
    const to = window.to ? endOfIsoDay(window.to) : new Date();
    const defaultFrom = new Date(to.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS);
    const from = window.from ? startOfIsoDay(window.from) : defaultFrom;
    return { from, to };
}

/**
 * Resolve a request's `from`/`to` into a current + previous comparison
 * window. The previous half is the same-length trailing window ending
 * 1ms before `current.from` — the 1ms gap prevents double-counting
 * rows on the boundary.
 */
export function resolveWindow(window: OverviewWindowQuery): ResolvedWindow {
    const current = resolveRange(window);
    const lengthMs = Math.max(
        current.to.getTime() - current.from.getTime(),
        DAY_MS
    );
    const previousTo = new Date(current.from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - lengthMs);
    return {
        current,
        previous: { from: previousFrom, to: previousTo },
    };
}

export function startOfIsoDay(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
}

export function endOfIsoDay(value: string): Date {
    return new Date(`${value}T23:59:59.999Z`);
}
