/** Outcomes a native host is told about. `share`/`copy` are asks, not reports: `navigator.share` doesn't exist in an Android WebView, and the reward-bearing share must be signed by the SDK's keypair, which this page can't access. `error` lets the host close its sheet; `code` hands over the install code for the SDK to pasteboard; `ready` says the page has painted, so the host can drop its loading skeleton on a fact instead of a timer. */
export type HostResultAction =
    | "install"
    | "dismiss"
    | "shareAgain"
    | "share"
    | "copy"
    | "error"
    | "code"
    | "ready";

/**
 * Build the URL that hands an outcome back to a native host.
 *
 * The host intercepts this navigation in its own web view before it reaches the OS — that's
 * the only reason `code` may carry a capability value here. A page loaded anywhere else would
 * turn this into a real scheme launch, making `value` readable by any app registering the scheme.
 * `sid` is the host's own correlation token; mismatched callbacks are dropped.
 */
export function buildHostResultUrl({
    scheme,
    action,
    sid,
    value,
    expiresAt,
}: {
    scheme: string;
    action: HostResultAction;
    sid?: string;
    /** The install code, for `action: "code"`. Ignored otherwise. */
    value?: string;
    /** When `value` stops being valid, as epoch seconds. */
    expiresAt?: number;
}): string {
    const params = new URLSearchParams({ action });
    if (sid) params.set("sid", sid);
    if (action === "code" && value) {
        params.set("value", value);
        if (expiresAt !== undefined) params.set("exp", String(expiresAt));
    }
    return `${scheme}://result?${params}`;
}

/** Outcomes already handed to the host, so none is sent twice. Keyed by action and value: the install code can change across a remount, so a different code still reaches the host even though a repeat of the same one is suppressed. */
const sentActions = new Set<string>();

/** Actions the dedupe above skips. `share`/`copy` are direct button-press results, not route-guard re-entrancy, and suppressing a repeat would be wrong — e.g. copying then sharing, or retrying a share the user backed out of. `ready` is per-presentation: a host reuses one warmed page across many sheets, and every one of them has its own skeleton waiting to be dropped. */
const REPEATABLE_ACTIONS: ReadonlySet<HostResultAction> = new Set([
    "share",
    "copy",
    "ready",
]);

/**
 * Hand an outcome to the host, at most once per page bar [REPEATABLE_ACTIONS].
 *
 * Route guards are not navigations: the router re-runs `beforeLoad` whenever
 * it resolves the location again, and it does so on load because
 * `validateSearch` fills in absent flags, which rewrites the URL. A guard that
 * navigated on every run therefore fired the same outcome twice, and the host
 * cannot tell the copies apart since both carry the session's own `sid`.
 *
 * Returns whether the navigation was issued, so callers can fall through to
 * their web behaviour when there is no host to hand off to.
 */
export function sendHostResult({
    scheme,
    action,
    sid,
    value,
    expiresAt,
}: {
    scheme?: string;
    action: HostResultAction;
    sid?: string;
    value?: string;
    expiresAt?: number;
}): boolean {
    if (!scheme) return false;
    if (!REPEATABLE_ACTIONS.has(action)) {
        const key = value === undefined ? action : `${action}:${value}`;
        if (sentActions.has(key)) return true;
        sentActions.add(key);
    }
    window.location.assign(
        buildHostResultUrl({ scheme, action, sid, value, expiresAt })
    );
    return true;
}

/** Test seam: forget what has been sent. */
export function resetHostResults() {
    sentActions.clear();
}
