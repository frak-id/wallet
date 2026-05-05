/**
 * Diagnostics events — runtime error tracking surfaced via `recordError`.
 *
 * Decoupled from typed flow events on purpose: we want a single bucket on
 * the OpenPanel dashboard for `app_error`, sliced by `source` + the
 * platform global properties (isTauri / platform).
 */
export type AppErrorSource =
    | "bootstrap"
    | "window_error"
    | "unhandled_rejection"
    | "react_router"
    | "deep_link"
    | "biometrics"
    | "service_worker"
    | "tokens_send"
    | "monerium_callback"
    | "recovery"
    | "sso"
    | "notifications"
    | "safe_area"
    | "pending_actions"
    | "manual";

/**
 * `app_error` payload. Extra fields tunneled through `recordError(err, context)`
 * are attached via the index signature.
 *
 * Note: `app_version`, `isTauri`, and `platform` are also attached as OpenPanel
 * global properties at init time — duplicating them here makes the event
 * self-describing if the global props were ever lost (e.g. early bootstrap
 * errors firing before `initAnalytics`).
 */
export type DiagnosticsEventMap = {
    app_error: {
        message: string;
        name: string;
        stack?: string;
        release?: string;
        source: AppErrorSource;
        isTauri: boolean;
        platform: "ios" | "android" | "web" | "unknown";
        [key: string]: unknown;
    };
};
