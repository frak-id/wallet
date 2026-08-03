/**
 * Outcomes a native host is told about.
 *
 * `shared` and `copied` are absent on purpose: the host owns those controls
 * and already knows. `error` reports a rejected launch, so the host can close
 * its sheet instead of leaving it on a page it cannot interpret. `code` hands
 * over the install code so the SDK can write a pasteboard entry with an expiry
 * and `localOnly` — options this page cannot set itself.
 */
export type HostResultAction =
    | "install"
    | "dismiss"
    | "shareAgain"
    | "error"
    | "code";

/**
 * Build the URL that hands an outcome back to a native host.
 *
 * The host intercepts this navigation inside its own web view and cancels it, so it never
 * reaches the OS. That is the condition under which `code` may carry a capability value at
 * all — see `01-platform-changes.md` §1.2, which permits it only while that holds. A
 * `returnScheme` on a page loaded anywhere else turns this into a real scheme launch, and
 * then `value` is readable by any app registering the scheme.
 *
 * `sid` is the host's own correlation token; callbacks that do not match the session it
 * opened are dropped.
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

/**
 * Outcomes already handed to the host, so none is sent twice.
 *
 * Keyed by action *and* value: every other action is terminal and fires once, but the
 * install code is refetchable (`useGenerateInstallCode` sets no `staleTime`), and a second,
 * different code must reach the host or the pasteboard keeps one the page is no longer
 * showing. A repeat of the *same* code is still suppressed.
 */
const sentActions = new Set<string>();

/**
 * Hand an outcome to the host, at most once per page.
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
    const key = value === undefined ? action : `${action}:${value}`;
    if (sentActions.has(key)) return true;
    sentActions.add(key);
    window.location.assign(
        buildHostResultUrl({ scheme, action, sid, value, expiresAt })
    );
    return true;
}

/** Test seam: forget what has been sent. */
export function resetHostResults() {
    sentActions.clear();
}
