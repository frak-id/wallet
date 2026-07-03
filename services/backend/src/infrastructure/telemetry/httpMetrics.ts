import { Elysia } from "elysia";
import { Counter, Gauge, Histogram } from "prom-client";
import { register } from "./registry";

/**
 * HTTP-layer metrics, exposed as a single Elysia plugin mounted globally.
 *
 * Performance:
 *  - Three metric singletons, created once here (never per-request).
 *  - Labels use the matched route TEMPLATE (`ctx.route`, e.g.
 *    `/business/merchant/:id/campaigns`) — never the raw URL — so cardinality
 *    stays bounded regardless of path params (UUIDs, addresses, codes).
 *  - `/metrics` and `/health` are excluded (noisy probe / self-observation).
 *  - Per-request start time lives in a WeakMap keyed by the request object:
 *    correct under concurrency (unlike the global `store`) and GC-friendly.
 */

const httpRequestsTotal = register(
    new Counter({
        name: "http_requests_total",
        help: "Total HTTP requests",
        labelNames: ["method", "route", "status_code", "bff"] as const,
    })
);

const httpRequestDuration = register(
    new Histogram({
        name: "http_request_duration_seconds",
        help: "HTTP request duration in seconds",
        labelNames: ["method", "route", "bff"] as const,
        // Tight, API-oriented buckets — keep histogram series count low.
        buckets: [0.005, 0.025, 0.1, 0.25, 0.5, 1, 2.5, 5],
    })
);

const httpRequestsInFlight = register(
    new Gauge({
        name: "http_requests_in_flight",
        help: "In-flight HTTP requests",
        labelNames: ["bff"] as const,
    })
);

const pending = new WeakMap<Request, { start: number; bff: string }>();

/**
 * Extract the pathname from a full request URL without allocating a URL object.
 * `http://host/path?q` -> `/path`
 */
export function pathnameOf(url: string): string {
    const schemeEnd = url.indexOf("://");
    const start = schemeEnd === -1 ? 0 : url.indexOf("/", schemeEnd + 3);
    if (start === -1) return "/";
    let end = url.indexOf("?", start);
    if (end === -1) end = url.length;
    return url.slice(start, end);
}

/** Derive the BFF bucket from a path prefix. Cheap prefix checks, no regex. */
export function bffOf(path: string): string {
    if (path.startsWith("/business")) return "business";
    if (path.startsWith("/user")) return "user";
    if (path.startsWith("/ext")) return "external";
    if (path.startsWith("/common") || path.startsWith("/.well-known"))
        return "common";
    return "other";
}

export function isExcluded(path: string): boolean {
    return path === "/metrics" || path === "/health";
}

export const httpMetrics = new Elysia({ name: "telemetry.http" })
    .onRequest(({ request }) => {
        // Runs before routing: the matched template isn't known yet, so derive
        // the (static-prefix) bff from the pathname here and capture the route
        // template later in onAfterResponse/onError.
        const path = pathnameOf(request.url);
        if (isExcluded(path)) return;
        const bff = bffOf(path);
        pending.set(request, { start: performance.now(), bff });
        httpRequestsInFlight.inc({ bff });
    })
    .onAfterResponse({ as: "global" }, ({ request, route, set }) => {
        const entry = pending.get(request);
        if (entry === undefined) return;
        pending.delete(request);
        record(
            request.method,
            route,
            entry.bff,
            entry.start,
            set.status ?? 200
        );
    })
    .onError({ as: "global" }, ({ request, route, set, code, error }) => {
        const entry = pending.get(request);
        if (entry === undefined) return;
        pending.delete(request);
        record(
            request.method,
            route,
            entry.bff,
            entry.start,
            errorStatus(code, error, set)
        );
    })
    .as("global");

/** Map Elysia's error `code` to an HTTP status. */
function codeToStatus(code: string): number {
    switch (code) {
        case "NOT_FOUND":
            return 404;
        case "VALIDATION":
            return 422;
        case "PARSE":
        case "INVALID_COOKIE_SIGNATURE":
            return 400;
        default:
            return 500;
    }
}

/**
 * Resolve the status at error time. `set.status` is unreliable here (Elysia
 * writes framework statuses like 404 only AFTER onError runs), so prefer an
 * explicit `error.status`, then the error `code`, then any already-set status.
 */
function errorStatus(
    code: string | number,
    error: unknown,
    set: { status?: number | string }
): number {
    const errStatus = (error as { status?: unknown }).status;
    if (typeof errStatus === "number") return errStatus;
    if (typeof code === "string" && code !== "UNKNOWN")
        return codeToStatus(code);
    if (typeof set.status === "number" && set.status >= 400) return set.status;
    return 500;
}

function record(
    method: string,
    route: string | undefined,
    bff: string,
    start: number,
    status: number | string
) {
    httpRequestsInFlight.dec({ bff });
    // Never fall back to the raw pathname — an unmatched request would turn
    // bot/scanner paths into unbounded label values.
    const r = route ?? "unmatched";
    const status_code = String(status);
    httpRequestsTotal.inc({ method, route: r, status_code, bff });
    httpRequestDuration.observe(
        { method, route: r, bff },
        (performance.now() - start) / 1000
    );
}
