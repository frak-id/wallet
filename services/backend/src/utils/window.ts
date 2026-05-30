const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sentinel "earliest possible date" — used as the lower bound when the
 * request omits `from`, denoting an unbounded (lifetime) window.
 * Predates any merchant data so PG `BETWEEN` filters degenerate to an
 * open lower edge.
 */
const LIFETIME_START = new Date(0);

export type DateRange = { from: Date; to: Date };

/**
 * Same-length comparison window: `current` is the requested range,
 * `previous` is the trailing range of identical length ending 1ms
 * before `current.from`. `hasComparison` is false when the request
 * was unbounded (lifetime) — `previous` collapses to a degenerate
 * empty range so FILTER aggregates yield 0 and the FE hides delta
 * chips.
 */
export type ResolvedWindow = {
    current: DateRange;
    previous: DateRange;
    hasComparison: boolean;
};

/**
 * Loose query shape accepted by `resolveWindow`. Both bounds are
 * optional ISO `yyyy-MM-dd` strings; omitting `from` puts the window
 * in lifetime mode (all-time range, no comparison).
 */
export type WindowQuery = { from?: string; to?: string };

/**
 * Resolve a request's `from`/`to` into a current + previous comparison
 * window. The previous half is the same-length trailing window ending
 * 1ms before `current.from` — the 1ms gap prevents double-counting
 * rows on the boundary. When `from` is omitted (lifetime), there is
 * no meaningful previous window: `previous` collapses to a degenerate
 * empty range and `hasComparison` is false.
 */
export function resolveWindow(window: WindowQuery): ResolvedWindow {
    const to = window.to ? endOfIsoDay(window.to) : new Date();
    const from = window.from ? startOfIsoDay(window.from) : LIFETIME_START;
    const current: DateRange = { from, to };

    if (!window.from) {
        return {
            current,
            previous: { from: LIFETIME_START, to: LIFETIME_START },
            hasComparison: false,
        };
    }

    const lengthMs = Math.max(
        current.to.getTime() - current.from.getTime(),
        DAY_MS
    );
    const previousTo = new Date(current.from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - lengthMs);
    return {
        current,
        previous: { from: previousFrom, to: previousTo },
        hasComparison: true,
    };
}

export function startOfIsoDay(value: string): Date {
    return new Date(`${value}T00:00:00.000Z`);
}

export function endOfIsoDay(value: string): Date {
    return new Date(`${value}T23:59:59.999Z`);
}
