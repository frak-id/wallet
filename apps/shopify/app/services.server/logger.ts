import { AsyncLocalStorage } from "node:async_hooks";
import { isRunningLocally } from "@frak-labs/app-essentials";
import { pino } from "pino";

/**
 * Structured JSON logging for the Shopify app — same scheme as the backend
 * (services/backend/src/infrastructure/external/logger.ts): a pino logger that
 * emits JSON in deployed environments and pretty-prints locally.
 *
 * Why this exists (see the logging audit):
 *  - On GKE, `console.warn` → stderr → classified as ERROR severity, so plain
 *    `console.*` warnings pollute the error dashboards. pino writes a single
 *    JSON object per line with an explicit `level`, so severity is honest.
 *  - Every line carries the per-request correlation fields ({ reqId, shop,
 *    merchantId, route }) via the request-scoped store below, so a failing log
 *    line can be tied back to the ingress request id and the merchant.
 */

/**
 * Per-request correlation fields merged into every log line emitted while the
 * request is being handled. `reqId`/`route` are set once at the server edge
 * (server.js); `shop`/`merchantId` are enriched by loaders as they resolve
 * them (via {@link setRequestContext}).
 */
export type RequestLogContext = {
    reqId?: string;
    shop?: string;
    merchantId?: string;
    route?: string;
};

const requestContextStore = new AsyncLocalStorage<RequestLogContext>();

/**
 * Run `fn` with a fresh request-scoped logging context. Called once per request
 * at the server edge so all downstream loaders/actions/services inherit it.
 */
export function runWithRequestContext<T>(
    context: RequestLogContext,
    fn: () => T
): T {
    return requestContextStore.run(context, fn);
}

/**
 * Enrich the current request's logging context in place (e.g. once a loader has
 * resolved `shop`/`merchantId`). No-op outside a request scope.
 */
export function setRequestContext(patch: Partial<RequestLogContext>): void {
    const store = requestContextStore.getStore();
    if (!store) return;
    for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) {
            (store as Record<string, unknown>)[key] = value;
        }
    }
}

/** Read the current request's logging context, if any. */
export function getRequestContext(): RequestLogContext | undefined {
    return requestContextStore.getStore();
}

/**
 * Pick a log level for a backend/HTTP error by status code:
 *  - 404 → `info`: routine "not registered / not found yet", not a failure.
 *  - other 4xx → `warn`: client-shaped, expected but worth noticing.
 *  - 5xx / unknown → `error`: a real server-side failure.
 */
export function levelForStatus(status?: number): "info" | "warn" | "error" {
    if (status === 404) return "info";
    if (typeof status === "number" && status >= 400 && status < 500) {
        return "warn";
    }
    return "error";
}

export const log = pino({
    name: "shopify",
    level: process.env.LOG_LEVEL ?? "debug",
    // Merge the request-scoped correlation fields into every line.
    mixin() {
        return requestContextStore.getStore() ?? {};
    },
    transport: isRunningLocally
        ? {
              target: "pino-pretty",
              options: {
                  colorize: true,
              },
          }
        : undefined,
});
