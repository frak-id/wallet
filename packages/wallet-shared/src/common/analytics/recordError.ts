import type { AppErrorSource } from "./events";
import { getPlatformInfo } from "./openpanel";
import { trackEvent } from "./trackEvent";

/**
 * Maximum stack length to send to OpenPanel — keeps each event well under
 * the per-payload limit while preserving enough frames to debug.
 */
const STACK_TRUNCATE_LIMIT = 4000;

/**
 * Options accepted by `recordError`. `source` defaults to "manual" so call
 * sites only need to override it where the source is meaningful (global
 * handlers, route boundaries, etc.).
 */
export type RecordErrorOptions = {
    source?: AppErrorSource;
    /**
     * Free-form extras forwarded to OpenPanel. Use for breadcrumb-style
     * fields like `flow_id`, `route`, `wallet`, or domain-specific context.
     */
    context?: Record<string, unknown>;
};

/**
 * Normalise an unknown thrown value into a real `Error` instance.
 * Mirrors the pattern used by `extractAuthError` in `index.ts` but keeps
 * the original error stack when available.
 */
function toError(err: unknown): Error {
    if (err instanceof Error) return err;
    if (typeof err === "string") return new Error(err);
    try {
        return new Error(JSON.stringify(err));
    } catch {
        return new Error(String(err));
    }
}

/**
 * Report a runtime error to OpenPanel as an `app_error` event.
 *
 * Designed to be safe to call from anywhere — module load, async callbacks,
 * service worker, listener handlers. No-ops when OpenPanel is not configured
 * (e.g. listener app today, tests), so adding a call site is never a hazard.
 *
 * Splits on the dashboard come from the OpenPanel global properties
 * (`isTauri`, `platform`, `app_version`) attached at `initAnalytics`; the
 * same fields are denormalised onto the event payload to keep it
 * self-describing if globals weren't ready yet (very early bootstrap errors).
 */
export function recordError(
    err: unknown,
    options: RecordErrorOptions = {}
): void {
    const error = toError(err);
    const { source = "manual", context } = options;

    // Single source of truth for client-side errors. `console.error` keeps
    // dev-tools visibility — `vite-plugin-remove-console` strips it from
    // production bundles, leaving only the OpenPanel emission.
    console.error(`[recordError:${source}]`, error, context);

    trackEvent("app_error", {
        message: error.message || error.name || "unknown",
        name: error.name,
        stack: error.stack?.slice(0, STACK_TRUNCATE_LIMIT),
        release: process.env.APP_VERSION,
        source,
        ...getPlatformInfo(),
        ...context,
    });
}
