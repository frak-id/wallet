import { collectDefaultMetrics, type Metric, Registry } from "prom-client";

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
 * Keeps metric definition files terse while guaranteeing a single registry.
 */
export function register<T extends Metric>(metric: T): T {
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
