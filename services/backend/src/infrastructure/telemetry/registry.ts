import {
    collectDefaultMetrics,
    type Metric,
    Registry,
} from "@prometheus-io/client";

/**
 * Single shared Prometheus registry for the whole backend.
 *
 * Performance notes:
 *  - One registry, metric instances are module singletons created once at
 *    import time (never per-request). See sibling files in this folder.
 *  - Default collectors (event loop lag, RSS, heap, GC) are cheap and are
 *    especially useful here to observe the known Bun RSS growth
 *    (see `/health` restart workaround in `src/index.ts`).
 */
export const registry = new Registry();

collectDefaultMetrics({ register: registry });

/**
 * Helper to register a metric on the shared registry and return it typed.
 * `Metric<string>` is explicit: the bare `Metric` defaults its label-name
 * parameter to `never`, which no labelled metric satisfies.
 */
export function register<T extends Metric<string>>(metric: T): T {
    registry.registerMetric(metric);
    return metric;
}

/**
 * Render the current metrics in Prometheus text exposition format.
 * Cheap: a single serialization pass over already-tracked values.
 */
export function renderMetrics(): Promise<string> {
    return registry.metrics();
}

export const metricsContentType = registry.contentType;
